# @rhythmjs/scalar

The [Scalar](https://scalar.com) API reference page for [Rhythm](https://github.com/rhythmjs/rhythm) on Bun. Mount
`scalarModule` and you get a documentation page that renders any OpenAPI document by URL. It pairs naturally with
[`@rhythmjs/openapi`](../openapi), which serves the document at `/openapi.json`, but it works with any other source.

## Install

```sh
bun add @rhythmjs/scalar @rhythmjs/rhythm @rhythmjs/router
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
import { scalarModule } from "@rhythmjs/scalar";

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
  .use(mount(scalarModule.forRoot({ theme: "purple" }))) // GET /docs
  .use(mount(hello));

Bun.serve({ fetch: toFetchHandler(app) });
```

Visit `/docs`. With no `url`, `sources` or `content`, the page loads `/openapi.json`. To document a spec from somewhere
else, skip `openapiModule` and pass `url`:

```ts
new Rhythm().use(mount(scalarModule.forRoot({ url: "https://example.com/openapi.json" })));
```

## API

### `scalarModule.forRoot(options?)`

Returns a `RhythmRouter` (named `scalar`) with one `GET` route, to be added with `mount()`. The HTML is rendered once,
when `forRoot` is called.

`ScalarOptions` is `Partial<HtmlRenderingConfiguration> & { path?: string }`: Scalar's own configuration (from
`@scalar/client-side-rendering`), plus `path`.

| Option      | Default                                          | Meaning                                                                                                   |
| ----------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `path`      | `/docs`                                          | Where the page is served.                                                                                 |
| `url`       | `/openapi.json` (only if no `sources`/`content`) | The document the page loads.                                                                              |
| `sources`   |                                                  | Several documents in one page, `{ url, title?, slug?, default? }[]`, shown in Scalar's document dropdown. |
| `pageTitle` | Scalar's default                                 | The page title.                                                                                           |
| `nonce`     |                                                  | A Content-Security-Policy nonce for the inline scripts.                                                   |
| `cdn`       | jsDelivr                                         | URL of the single-file Scalar bundle, for self-hosting or pinning a version.                              |
| `bundle`    |                                                  | `false` to use the single-file bundle, or the URL of a specific ESM build.                                |

Every other option is passed to Scalar as configuration: `theme`, `layout`, `darkMode`, `hideModels`, `customCss`, and
the rest of [Scalar's options](https://scalar.com/products/api-references/configuration).

By default the page loads Scalar from jsDelivr in the browser, so the browser needs network access and there is no
Subresource Integrity pin. Set `cdn` or `bundle` to a URL you control to change that.

### Several documents

`sources` puts several documents in one page. Each group module can keep its own `openapiModule` (and so its own
document), while one UI at the top lists them all:

```ts
const app = new Rhythm()
  .use(mount(apiModule)) // mounts its own openapiModule at /api/v1/openapi.json
  .use(mount(platformModule)) // mounts its own openapiModule at /api/platform/openapi.json
  .use(
    mount(
      scalarModule.forRoot({
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
- To offer Swagger UI as well, mount [`swaggerModule`](../swagger) with a different `path`.
