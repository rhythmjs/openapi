# @rhythmjs/swagger

The [Swagger UI](https://swagger.io/tools/swagger-ui/) page for [Rhythm](https://github.com/rhythmjs/rhythm) on Bun.
It serves a small HTML page that loads Swagger UI from a CDN and points it at an OpenAPI document URL. It does not
generate or serve the document: pair it with [`@rhythmjs/openapi`](../openapi), or point `url` at any other source.

## Install

```sh
bun add @rhythmjs/swagger @rhythmjs/http @rhythmjs/rhythm @rhythmjs/router
```

`@rhythmjs/http` is a peer: the page is mounted with `@rhythmjs/http/mount`.

## Usage

```ts
import { Rhythm } from "@rhythmjs/rhythm";
import { openapiModule } from "@rhythmjs/openapi/module";
import { swaggerModule } from "@rhythmjs/swagger";

const app = new Rhythm<RhythmHttpContext>()
  .register(openapiModule.forRoot({ document: config })) // GET /openapi.json
  .register(swaggerModule.forRoot({ swaggerOptions: { docExpansion: "none" } })) // GET /docs
  .use(users.middleware());
```

`swaggerModule.forRoot(options?)` answers `GET` on its `path` only (an exact match) and leaves every other request to
the app. The page is built once when the module is created. Register it before any catch-all middleware.

| Option           | Default         | Meaning                                                                                                                         |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `path`           | `/docs`         | where the page is served                                                                                                        |
| `url`            | `/openapi.json` | the document the page loads (escaped into the page's JavaScript)                                                                |
| `sources`        |                 | several documents in one page, `{ url, title? }[]`, in Swagger UI's top-bar dropdown; exclusive with `url`                      |
| `pageTitle`      | `API Reference` | the page title (HTML-escaped)                                                                                                   |
| `swaggerOptions` |                 | merged into `SwaggerUIBundle` (`docExpansion`, `persistAuthorization`, ...); `url` and `dom_id` stay under the module's control |
| `nonce`          |                 | a Content-Security-Policy nonce set on every script tag                                                                         |
| `cdn`            |                 | your own copy of Swagger UI: the folder holding `swagger-ui.css` and `swagger-ui-bundle.js` (http(s) or root-relative)          |

## Several documents

`sources` puts several documents in one page through Swagger UI's top bar (`urls` with the standalone preset and the
`StandaloneLayout`; each `title` becomes the entry's `name`). The preset is one more script from the same pinned
`swagger-ui-dist` version, with its own integrity hash, and it is only loaded when `sources` is used. Each group module
can keep its own `openapiModule` while one UI at the top lists them all:

```ts
swaggerModule.forRoot({
  sources: [
    { url: "/api/v1/openapi.json", title: "Public API" },
    { url: "/api/platform/openapi.json", title: "Platform API" },
  ],
});
```

By default Swagger UI loads from unpkg at an exact pinned version with Subresource Integrity hashes, so a moved or
compromised CDN file is refused by the browser. A custom `cdn` drops the built-in hashes, because they belong to the
default files. The browser needs network access to render the page. Register `swaggerModule` next to
[`@rhythmjs/scalar`](../scalar) with different `path` options to offer both UIs.
