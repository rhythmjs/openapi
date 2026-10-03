# @rhythmjs/openapi

OpenAPI 3.1 documentation for [Rhythm](https://github.com/rhythmjs/rhythm), the Bun-native backend
framework. Routes are documented by small single-purpose middlewares (`apiBody`, `apiResponse`, `apiTags`, …); a generator walks the
routers and produces the document; a module serves it as JSON. Reference UIs live in separate packages:
[`@rhythmjs/scalar`](../scalar) and [`@rhythmjs/swagger`](../swagger). Each module is exported by its own subpath;
there is no root barrel export.

Schemas are [Standard Schema v1](https://standardschema.dev). Conversion to JSON Schema goes through the
Standard JSON Schema interface (`~standard.jsonSchema`, spec 1.1); zod v4.2+ implements it natively, and raw
JSON Schema objects pass through untouched.

## Install

```sh
bun add @rhythmjs/openapi @rhythmjs/http @rhythmjs/rhythm @rhythmjs/router
```

`@rhythmjs/router` >= 0.0.6 is required (the generator reads `router.entries`). `zod` >= 4.2 is an optional
peer, only needed when your routes use zod schemas (raw JSON Schema objects work without it).

## Quick start

```ts
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { apiBody, type Validated } from "@rhythmjs/openapi/body";
import { apiParam } from "@rhythmjs/openapi/param";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiTags } from "@rhythmjs/openapi/tags";
import { apiBearerAuth } from "@rhythmjs/openapi/security";
import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { z } from "zod";

const User = z.object({ id: z.string(), name: z.string() });
const CreateUser = z.object({ name: z.string().min(1) });

const users = new RhythmRouter({ prefix: "/users" })
  .use(apiTags("users"))
  .post<Validated<"body", typeof CreateUser>>(
    "/",
    apiBody(CreateUser),
    apiOperation({ summary: "Create user", operationId: "createUser" }),
    apiBearerAuth(),
    apiResponse(201, { description: "Created", schema: User }),
    (ctx) => {
      // ctx.valid.body is fully typed as the schema output ({ name: string })
      ctx.json({ id: "1", ...ctx.valid.body }, 201);
    },
  )
  .get(
    "/:id",
    apiParam(z.object({ id: z.string() })),
    apiResponse(200, { description: "The user", schema: User }),
    (ctx) => {
      ctx.json({ id: ctx.params.id, name: "Ada" });
    },
  );

const config = defineDocument({
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
});

const app = new Rhythm<RhythmHttpContext>()
  .register(openapiModule.forRoot({ document: config })) // GET /openapi.json
  .use(users.middleware());
```

## Request middlewares (validate + document)

These take a Standard Schema, validate the request at runtime (exposing the typed output on
`ctx.valid[target]`, same contract and 400 `ValidationFailure` shape as `@rhythmjs/middleware/validate`), and
document the corresponding OpenAPI object. Use either these or `@rhythmjs/middleware/validate` on a route, not
both, or the request is validated twice.

- `apiBody(schema, options?)`: Request Body Object. Options: `description`, `required`, `contentType`
  (drives extraction too: JSON, forms, or raw text), `example(s)`, `encoding`, or a full `content` map.
- `apiQuery(schema, options?)`: query Parameter Objects, one per schema property; repeated keys become arrays.
- `apiParam(schema, options?)`: path Parameter Objects (always `required: true`).
- `apiHeader(schema, options?)`: header Parameter Objects (header names are lowercased).
- `apiCookie(schema, options?)`: cookie Parameter Objects, parsed from the `cookie` header.

Parameter middlewares accept per-property `overrides` for everything a schema cannot express:
`description`, `required`, `deprecated`, `style`, `explode`, `allowReserved`, `allowEmptyValue`, `example(s)`.

## Documentation-only middlewares

Runtime no-ops that carry spec fragments. Apply per-route, or router-wide with `router.use(...)`; a
router-level fragment applies to every route registered after it.

- `apiOperation({ summary, description, operationId, deprecated, externalDocs, servers })`
- `apiResponse(status, { description, schema?, contentType?, example(s)?, content?, headers?, links? })`:
  stackable; `status` is a code, a range (`"5XX"`), or `"default"`.
- `apiTags(...names)`
- `apiSecurity(name, scopes?)` plus presets `apiBearerAuth()`, `apiBasicAuth()`, `apiCookieAuth()`,
  `apiKeyAuth()`, `apiOAuth2(scopes)`, and `apiNoSecurity()` (documents `security: []`).
- `apiExclude()`: hide a route (or a whole router via `use`).
- `apiExtension("x-...", value)`
- `apiCallback(name, callbackObject)`

There are no model-level annotations: property documentation lives in the schema itself (zod `.describe()` /
`.meta()`) and flows through the JSON Schema conversion.

## Document config and generation

Everything that is not a route concern is a plain config object:

```ts
import { defineDocument } from "@rhythmjs/openapi/document";
import { generate } from "@rhythmjs/openapi/generate";

const config = defineDocument({
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  tags: [{ name: "users", description: "User management" }],
  security: [{ bearer: [] }], // global security; apiNoSecurity() opts a route out
  securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
  webhooks: { "user.created": { post: { responses: { "200": { description: "Received" } } } } },
  components: {}, // reusable components, merged verbatim
  extensions: { "x-audience": "public" },
});

const doc = await generate(router, config, {
  // openapi: "3.1.2", includeUndocumented: false,
});
```

`generate` walks `router.entries`, merges fragments per route, converts `:id` to `{id}`, resolves schemas
(request schemas on their input side, response schemas on their output side), and hoists `$defs` into
`components.schemas`. Undocumented routes are dropped by default so internal routes are not
published by accident; `includeUndocumented: true` lists them with a default `200` response.

## Serving the document

`openapiModule.forRoot({ document, path?, openapi?, includeUndocumented? })` is a kernel module, in the spirit of
NestJS's `SwaggerModule`. Register it once and mount your routers as usual: it scans the app it is registered in
(including nested modules) for routers, so no router is ever passed to it. It serves the document as JSON at
`/openapi.json` (`path` moves it), mounted with `@rhythmjs/http/mount`, so only `GET` on that exact path is answered
and everything else falls through to your app. The document is generated lazily once and cached; a failed generation
is evicted so the next request retries. It also puts `openapiService` on the module context, so `register(module, ({ openapiService }) => ({ openapiService }))` exposes `openapiService.document()` to the app.

A document covers the app its module is registered in, including everything registered inside that app. Register one
`openapiModule` at the root for a single document of the whole API, or one inside each group module for a separate
document per group, each at its own `path`; a UI at the top of the app can list them all with its `sources` option (see
[`examples/groups`](../../examples/groups)). The module has to be added
with `register()`, which is how it learns its app; mounting it with `use(module.middleware())` fails with an error on
the first request.

The module serves the document and nothing else, so any consumer can use it. To render it, register a UI package
next to it and point `url` at the document:

```ts
import { scalarModule } from "@rhythmjs/scalar"; // or swaggerModule from "@rhythmjs/swagger"

new Rhythm<RhythmHttpContext>()
  .register(openapiModule.forRoot({ document: config }))
  .register(scalarModule.forRoot({ theme: "purple" })) // GET /docs, loads /openapi.json
  .use(users.middleware());
```

The document endpoint has no authentication, and it publishes your route map. Register the module behind your own
auth (or only outside production) if the API is not public.

## Not covered

`OPTIONS`/`HEAD`/`TRACE` operations (the router does not route them) and Path Item-level fields (`summary`,
per-path `servers`); the `components.pathItems` escape hatch in the config covers the latter.
