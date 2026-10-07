# @rhythmjs/scalar

The [Scalar](https://scalar.com) API reference page for [Rhythm](https://github.com/rhythmjs/rhythm) on Bun. It serves
a small HTML page that loads Scalar from a CDN and points it at an OpenAPI document URL, rendered with Scalar's own
[`@scalar/client-side-rendering`](https://github.com/scalar/scalar/tree/main/packages/client-side-rendering), the
package behind Scalar's Hono, Express and other integrations. It does not generate or serve the document: pair it with
[`@rhythmjs/openapi`](../openapi), or point `url` at any other source.

## Install

```sh
bun add @rhythmjs/scalar @rhythmjs/rhythm @rhythmjs/router
```

The page is a plain `RhythmRouter` route, so only `GET` on that exact path is answered.

## Usage

```ts
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { openapiModule } from "@rhythmjs/openapi/module";
import { scalarModule } from "@rhythmjs/scalar";

const app = new Rhythm()
  .use(mount(openapiModule.forRoot({ document: config }))) // GET /openapi.json
  .use(mount(scalarModule.forRoot({ theme: "purple" }))) // GET /docs
  .use(mount(users));
```

`scalarModule.forRoot(options?)` is a module (a `Rhythm` app) that you add with `mount()`. It answers `GET` on its
`path` only (an exact match) and leaves every other request to the app. The page is rendered once when the module is
created. A mounted module hands over to the rest of the app afterwards, so a later catch-all should check the response
(`ctx.response.body === null`) before writing its own.

The options are Scalar's own, typed by `@scalar/types`, plus `path`:

| Option      | Default                                       | Meaning                                                                                                                 |
| ----------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `path`      | `/docs`                                       | where the page is served                                                                                                |
| `url`       | `/openapi.json` (when no `sources`/`content`) | the document the page loads                                                                                             |
| `sources`   |                                               | several documents in one page, `{ url, title?, slug?, default? }[]`, in Scalar's document dropdown                      |
| `pageTitle` | `Scalar API Reference`                        | the page title (HTML-escaped)                                                                                           |
| `nonce`     |                                               | a Content-Security-Policy nonce for the inline scripts; it also selects the single-file bundle, which can carry a nonce |
| `cdn`       | jsDelivr                                      | URL of the single-file (UMD) Scalar bundle, for self-hosting or pinning                                                 |
| `bundle`    |                                               | `false` for the single-file bundle, or the URL of a specific ESM build                                                  |

Every other option is Scalar's configuration, passed through as it is: `theme`, `layout`, `darkMode`, `hideModels`,
`customCss`, and the rest of [Scalar's options](https://scalar.com/products/api-references/configuration).

Like Scalar's own integrations, the page loads the latest Scalar build from jsDelivr, so the browser needs network
access to render it, and there is no version or Subresource Integrity pin. Set `cdn` or `bundle` to a URL you control
or a pinned version if you want one.

## Several documents

`sources` puts several documents in one page. Each group module can keep its own `openapiModule` (and so its own
document and scope), while one UI at the top of the app lists them all:

```ts
new Rhythm()
  .use(mount(apiModule)) // mounts openapiModule at /api/v1/openapi.json
  .use(mount(platformModule)) // mounts openapiModule at /api/platform/openapi.json
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
