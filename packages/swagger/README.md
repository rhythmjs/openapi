# @rhythmjs/swagger

The [Swagger UI](https://swagger.io/tools/swagger-ui/) page for [Rhythm](https://github.com/rhythmjs/rhythm) on Bun.
Mount `swaggerModule` and you get a documentation page that renders any OpenAPI document by URL. It pairs naturally
with [`@rhythmjs/openapi`](../openapi), which serves the document at `/openapi.json`, but it works with any other
source.

## Install

```sh
bun add @rhythmjs/swagger @rhythmjs/rhythm @rhythmjs/router
```

Requires `@rhythmjs/rhythm` and `@rhythmjs/router` >= 0.0.18 and Bun >= 1.2. To generate the document, also install
[`@rhythmjs/openapi`](../openapi).

## Walkthrough

```ts
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import { defineDocument } from "@rhythmjs/openapi/document";
import { documented } from "@rhythmjs/openapi/generate";
import { openapiModule } from "@rhythmjs/openapi/module";
import { apiResponse } from "@rhythmjs/openapi/response";
import { swaggerModule } from "@rhythmjs/swagger";

const hello = documented(new RhythmRouter()).get(
  "/hello",
  apiResponse(200, { description: "A greeting", contentType: "text/plain", schema: { type: "string" } }),
  (ctx) => {
    ctx.text("Hello World!");
  },
);

const document = defineDocument({ info: { title: "My API", version: "1.0.0" } });

const app = new Rhythm()
  .use(mount(openapiModule.forRoot({ document }))) // GET /openapi.json
  .use(mount(swaggerModule.forRoot({ swaggerOptions: { docExpansion: "none" } }))) // GET /docs
  .use(mount(hello));

Bun.serve({ fetch: toFetchHandler(app) });
```

Visit `/docs`. With no `url`, the page loads `/openapi.json`. To render a spec from somewhere else, skip
`openapiModule` and pass `url`:

```ts
new Rhythm().use(mount(swaggerModule.forRoot({ url: "https://example.com/openapi.json" })));
```

## API

### `swaggerModule.forRoot(options?)`

Returns a `RhythmRouter` (named `swagger`) with one `GET` route, to be added with `mount()`. The HTML is built once,
when `forRoot` is called.

```ts
interface SwaggerSource {
  url: string;
  title?: string;
}

interface SwaggerOptions {
  path?: string;
  url?: string;
  sources?: readonly SwaggerSource[];
  pageTitle?: string;
  swaggerOptions?: Record<string, unknown>;
  cdn?: string;
  nonce?: string;
}
```

| Option           | Default         | Meaning                                                                                                                       |
| ---------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `path`           | `/docs`         | Where the page is served.                                                                                                     |
| `url`            | `/openapi.json` | The document the page loads.                                                                                                  |
| `sources`        |                 | Several documents in one page, `{ url, title? }[]`, shown in Swagger UI's top-bar dropdown. Cannot be combined with `url`.    |
| `pageTitle`      | `API Reference` | The page title.                                                                                                               |
| `swaggerOptions` |                 | Merged into the `SwaggerUIBundle` configuration (`docExpansion`, `persistAuthorization`, ...). `url` and `dom_id` stay fixed. |
| `nonce`          |                 | A Content-Security-Policy nonce set on every script tag.                                                                      |
| `cdn`            | unpkg           | Your own copy of Swagger UI: the folder holding `swagger-ui.css` and `swagger-ui-bundle.js` (http(s) or root-relative).       |

Passing both `url` and `sources`, or a `cdn` that is neither an http(s) URL nor a root-relative path, throws a
`TypeError` from `forRoot`.

By default Swagger UI loads from unpkg at an exact pinned version with Subresource Integrity hashes, so a changed CDN
file is refused by the browser. A custom `cdn` drops those hashes, because they belong to the default files. The browser
needs network access to render the page.

### Several documents

`sources` puts several documents in one page through Swagger UI's top bar; each `title` becomes the entry name (the
`url` is used when there is no title). Each group module can keep its own `openapiModule` while one UI at the top lists
them all:

```ts
const app = new Rhythm()
  .use(mount(apiModule)) // mounts its own openapiModule at /api/v1/openapi.json
  .use(mount(platformModule)) // mounts its own openapiModule at /api/platform/openapi.json
  .use(
    mount(
      swaggerModule.forRoot({
        sources: [
          { url: "/api/v1/openapi.json", title: "Public API" },
          { url: "/api/platform/openapi.json", title: "Platform API" },
        ],
      }),
    ),
  );
```

See [`examples/groups`](../../examples/groups) for a complete app.

## Gotchas

- The page is a plain `RhythmRouter` route, so only `GET` on the exact `path` is answered. `/docs/` or `POST /docs`
  fall through to the rest of your app.
- `mount()` always calls `next()`, so requests the module does not answer continue to later middleware. A catch-all
  placed after it (a 404 handler, say) should check `ctx.response.body === null` before writing its own response, and
  belongs last in the app.
- The page does not generate or serve the document. If `url` points at a path nothing serves, the page loads but shows
  an error. Mount [`openapiModule`](../openapi) (or your own route) at that path.
- The document and the UI are public routes. Mount them behind your own auth, or only outside production, if the API is
  not public.
- To offer Scalar as well, mount [`scalarModule`](../scalar) with a different `path`.
