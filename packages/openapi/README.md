# @rhythmjs/openapi

OpenAPI 3.1 documentation for [Rhythm](https://github.com/rhythmjs/rhythm), the Bun-native backend framework. You
describe routes with small single-purpose middlewares (`apiBody`, `apiResponse`, `apiTags`, ...), wrap each router with
`documented()`, and mount `openapiModule`, which generates the document from your routers and serves it as JSON. To
render it, add [`@rhythmjs/scalar`](../scalar) or [`@rhythmjs/swagger`](../swagger).

Schemas are [Standard Schema v1](https://standardschema.dev). Conversion to JSON Schema uses the Standard JSON Schema
interface (`~standard.jsonSchema`): zod v4.2+ implements it natively, and raw JSON Schema objects pass through
untouched. Each feature is imported from its own subpath (`@rhythmjs/openapi/body`, `/response`, ...); there is no root
export.

## Install

```sh
bun add @rhythmjs/openapi @rhythmjs/rhythm @rhythmjs/router zod
```

Requires `@rhythmjs/rhythm` and `@rhythmjs/router` >= 0.0.18 and Bun >= 1.2. `zod` (>= 4.2) is an optional peer, only
needed when your routes use zod schemas.

## Walkthrough

```ts
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import { apiBody } from "@rhythmjs/openapi/body";
import { apiParam } from "@rhythmjs/openapi/param";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiTags } from "@rhythmjs/openapi/tags";
import { apiBearerAuth } from "@rhythmjs/openapi/security";
import { defineDocument } from "@rhythmjs/openapi/document";
import { documented } from "@rhythmjs/openapi/generate";
import { openapiModule } from "@rhythmjs/openapi/module";
import { z } from "zod";

const User = z.object({ id: z.string(), name: z.string() });
const CreateUser = z.object({ name: z.string().min(1) });

const usersRouter = documented(new RhythmRouter())
  .use(apiTags("users"))
  .post(
    "/users",
    apiBody(CreateUser),
    apiOperation({ summary: "Create user", operationId: "createUser" }),
    apiBearerAuth(),
    apiResponse(201, { description: "Created", schema: User }),
    (ctx) => {
      // ctx.valid.body is typed from the schema output: { name: string }
      ctx.json({ id: "1", ...ctx.valid.body }, 201);
    },
  )
  .get(
    "/users/:id",
    apiParam(z.object({ id: z.string() })),
    apiResponse(200, { description: "The user", schema: User }),
    (ctx) => {
      ctx.json({ id: ctx.params.id, name: "Ada" });
    },
  );

const document = defineDocument({
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
});

const app = new Rhythm()
  .use(mount(openapiModule.forRoot({ document }))) // GET /openapi.json
  .use(mount(usersRouter));

Bun.serve({ fetch: toFetchHandler(app) });
```

`GET /openapi.json` now returns the generated document. Add a UI next to it:

```ts
import { scalarModule } from "@rhythmjs/scalar"; // or swaggerModule from "@rhythmjs/swagger"

const app = new Rhythm()
  .use(mount(openapiModule.forRoot({ document })))
  .use(mount(scalarModule.forRoot())) // GET /docs, loads /openapi.json
  .use(mount(usersRouter));
```

## API

### `documented(router)`

From `@rhythmjs/openapi/generate`. `RhythmRouter` keeps its route table private, so wrap each router you want
documented right after constructing it, before any `use()` or route call. It records those calls on the same router
and returns it (typed also as `RouterSource`), so it mounts and serves as usual. Routes use full paths; there is no
router `prefix` option.

### `openapiModule.forRoot(options)`

From `@rhythmjs/openapi/module`. Returns a `RhythmRouter` (named `openapi`) to add with `mount()`.

| Option                | Default         | Meaning                                                                        |
| --------------------- | --------------- | ------------------------------------------------------------------------------ |
| `document`            | required        | The `OpenAPIConfig` (see below).                                               |
| `path`                | `/openapi.json` | Where the document is served.                                                  |
| `openapi`             | `"3.1.2"`       | The `openapi` version string in the output.                                    |
| `includeUndocumented` | `false`         | List routes of documented routers that carry no `api*` middleware (see below). |

The module scans the app it is mounted in, including nested modules and routers, for `documented()` routers, so no
router is ever passed to it. The document is generated on the first request and cached; a failed generation is not
cached, so the next request retries. The returned module also carries `openapiService.document()`, which resolves to
the generated document in code.

A document covers the app its module is mounted in. Mount one `openapiModule` at the root for a single document of the
whole API, or one inside each group module for a separate document per group, each at its own `path`. A UI at the top
of the app can list them all through its `sources` option (see [`examples/groups`](../../examples/groups)).

### Document config

`defineDocument(config)` (from `@rhythmjs/openapi/document`) returns the config unchanged, typed as `OpenAPIConfig`:

```ts
import { defineDocument } from "@rhythmjs/openapi/document";

const document = defineDocument({
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  tags: [{ name: "users", description: "User management" }],
  security: [{ bearer: [] }], // global security; apiNoSecurity() opts a route out
  securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
  webhooks: { "user.created": { post: { responses: { "200": { description: "Received" } } } } },
  components: {}, // reusable components, merged as given
  extensions: { "x-audience": "public" },
});
```

The remaining fields are `jsonSchemaDialect` and `externalDocs`.

### Request middlewares (validate and document)

`apiBody`, `apiQuery`, `apiParam`, `apiHeader` and `apiCookie` take a Standard Schema, validate that part of the request
at runtime, and document the matching OpenAPI object. The validated value is available, fully typed, on
`ctx.valid.body`, `ctx.valid.query`, `ctx.valid.param`, `ctx.valid.header` or `ctx.valid.cookie`. On failure they
respond `400` with `{ success: false, target, issues: [{ message, path? }] }`. Do not combine them with another
validator for the same part of the request, or it is validated twice.

| Middleware                 | Documents                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiBody(schema, opts?)`   | Request body. Options: `description`, `required` (default `true`), `contentType` (default `application/json`), `example`, `examples`, `encoding`, or a full `content` map. |
| `apiQuery(schema, opts?)`  | One query parameter per schema property. Repeated keys become arrays.                                                                                                      |
| `apiParam(schema, opts?)`  | Path parameters (always `required`), read from `ctx.params`.                                                                                                               |
| `apiHeader(schema, opts?)` | Header parameters. Header names are lowercased.                                                                                                                            |
| `apiCookie(schema, opts?)` | Cookie parameters, parsed from the `cookie` header.                                                                                                                        |

`apiBody` extracts according to `contentType`: JSON, `multipart/form-data`, `application/x-www-form-urlencoded`, or raw
text. The parameter middlewares accept `{ overrides: { [property]: ... } }` for what a schema cannot express:
`description`, `required`, `deprecated`, `style`, `explode`, `allowReserved`, `allowEmptyValue`, `example`, `examples`.

### Documentation-only middlewares

These do nothing at runtime; they only carry spec fragments. Use them on a single route, or router-wide with
`router.use(...)`: a router-level fragment applies to every route registered after it.

| Middleware                     | Effect                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `apiOperation(fields)`         | `summary`, `description`, `operationId`, `deprecated`, `externalDocs`, `servers`.                                             |
| `apiResponse(status, options)` | A response. Stackable. `status` is a code, `"1XX"` to `"5XX"`, or `"default"`.                                                |
| `apiTags(...names)`            | Tags.                                                                                                                         |
| `apiSecurity(name, scopes?)`   | A security requirement. Presets: `apiBearerAuth()`, `apiBasicAuth()`, `apiCookieAuth()`, `apiKeyAuth()`, `apiOAuth2(scopes)`. |
| `apiNoSecurity()`              | Documents `security: []`, opting out of global security.                                                                      |
| `apiExclude()`                 | Hides a route, or a whole router when used with `use()`.                                                                      |
| `apiExtension("x-...", value)` | A specification extension. Throws if the name does not start with `x-`.                                                       |
| `apiCallback(name, callback)`  | A callback object.                                                                                                            |

`apiResponse` options: `description` (required), `schema`, `contentType` (default `application/json`), `example`,
`examples`, `content` (a full media-type map), `headers`, `links`. The security presets use the scheme names `bearer`,
`basic`, `cookie`, `api-key` and `oauth2` by default (pass another name as the argument, or as the second argument of
`apiOAuth2`), and the name must match a key in `securitySchemes`.

Property documentation lives in the schema itself (zod `.describe()` / `.meta()`) and flows through the JSON Schema
conversion; there are no model-level annotations.

### Generating without the module

`generate(routers, config, options?)` from `@rhythmjs/openapi/generate` takes one `documented()` router or an array,
and resolves to the document object. Use it in a script (to write the spec to disk, say) or a test. Options are
`openapi` and `includeUndocumented`, as above.

It merges router-level and route-level fragments, converts `:id` to `{id}`, resolves schemas (request schemas by their
input type, response schemas by their output type), and hoists `$defs` into `components.schemas`.

## Gotchas

- A router that is not wrapped with `documented()`, or that is wrapped after routes were added, is silently left out of
  the document. Nothing warns you.
- Routes with no `api*` middleware are dropped by default, so internal routes are not published by accident. Set
  `includeUndocumented: true` to list them with a default `200` response.
- `openapiModule` is a plain `RhythmRouter` route: only `GET` on the exact `path` answers. It documents the app it is
  mounted in through `mount()`; the app it scans is whichever one you mounted it into, so mount it in the app that
  contains the routers you want. Used any other way, the first request fails with an error.
- `mount()` always calls `next()`, so requests the module does not answer fall through to later middleware. Mount
  order does not change what is documented, but a catch-all 404 handler must come last and should check
  `ctx.response.body === null` before writing a response.
- The document endpoint has no authentication and publishes your route map. Mount it behind your own auth, or only
  outside production, if the API is not public.
- A schema library without Standard JSON Schema support makes generation throw (on the first request to the document,
  not at startup). Use zod 4.2+ or pass a raw JSON Schema object.
- Not covered: `OPTIONS`, `HEAD` and `TRACE` operations (the generator documents `get`, `post`, `put`, `patch` and
  `delete`), and Path Item-level fields such as `summary` or per-path `servers`; `components.pathItems` in the config is
  the escape hatch.
