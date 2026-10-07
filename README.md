# Rhythm OpenAPI

OpenAPI 3.1 for [Rhythm](https://github.com/rhythmjs/rhythm), the Bun-native backend framework. Three packages that
work together:

- **`@rhythmjs/openapi`** documents your routes and generates the OpenAPI document. You describe routes with small
  middlewares (`apiBody`, `apiResponse`, `apiTags`, ...), wrap each router with `documented()`, and mount
  `openapiModule`, which serves the document as JSON at `/openapi.json`.
- **`@rhythmjs/scalar`** serves the [Scalar](https://scalar.com) API reference page.
- **`@rhythmjs/swagger`** serves the [Swagger UI](https://swagger.io/tools/swagger-ui/) page.

The two UI packages only render a document found at a URL. They do not depend on the generator, so they work with
`openapiModule` or with any other OpenAPI source.

## Use it with Rhythm

```ts
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import { apiBody } from "@rhythmjs/openapi/body";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiTags } from "@rhythmjs/openapi/tags";
import { defineDocument } from "@rhythmjs/openapi/document";
import { documented } from "@rhythmjs/openapi/generate";
import { openapiModule } from "@rhythmjs/openapi/module";
import { scalarModule } from "@rhythmjs/scalar";
import { swaggerModule } from "@rhythmjs/swagger";
import { z } from "zod";

const User = z.object({ id: z.string(), name: z.string() });
const CreateUser = z.object({ name: z.string().min(1) });

// Wrap the router with documented() right after creating it, or it is not documented.
const usersRouter = documented(new RhythmRouter())
  .use(apiTags("users"))
  .post("/users", apiBody(CreateUser), apiResponse(201, { description: "Created", schema: User }), (ctx) => {
    ctx.json({ id: "1", ...ctx.valid.body }, 201);
  });

const document = defineDocument({
  info: { title: "My API", version: "1.0.0" },
});

const app = new Rhythm()
  .use(mount(openapiModule.forRoot({ document }))) // GET /openapi.json
  .use(mount(scalarModule.forRoot())) // GET /docs
  .use(mount(swaggerModule.forRoot({ path: "/swagger" }))) // GET /swagger
  .use(mount(usersRouter));

Bun.serve({ fetch: toFetchHandler(app) });
```

Open `http://localhost:3000/docs` for Scalar, `/swagger` for Swagger UI, and `/openapi.json` for the raw document.

`openapiModule` documents the app it is mounted in, including everything mounted inside that app, so the order of the
`mount()` calls does not matter for what ends up in the document. Both UIs default to loading `/openapi.json`; pass
`url` (or `sources`, for several documents in one page) if you serve it elsewhere.

## Packages

| Package             | What it does                                                  | Install                                                           |
| ------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `@rhythmjs/openapi` | Documenting middlewares, document generation, `/openapi.json` | `bun add @rhythmjs/openapi @rhythmjs/rhythm @rhythmjs/router zod` |
| `@rhythmjs/scalar`  | Scalar API reference page                                     | `bun add @rhythmjs/scalar @rhythmjs/rhythm @rhythmjs/router`      |
| `@rhythmjs/swagger` | Swagger UI page                                               | `bun add @rhythmjs/swagger @rhythmjs/rhythm @rhythmjs/router`     |

`zod` is only needed if your routes use zod schemas; raw JSON Schema objects work without it. Each package has its own
README with the full API: [`openapi`](./packages/openapi), [`scalar`](./packages/scalar),
[`swagger`](./packages/swagger).

## Examples

- [`examples/hello`](./examples/hello): one controller with the documenting middlewares, `openapiModule`, and both UIs.
- [`examples/groups`](./examples/groups): an `api` and a `platform` module, each with its own document, listed together
  in one Scalar and one Swagger UI page.

Run one with `bun install && bun --cwd examples/hello start` (use `examples/groups` for the other).
