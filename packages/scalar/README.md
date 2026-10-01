# @rhythmjs/scalar

The [Scalar](https://scalar.com) API reference page for [Rhythm](https://github.com/rhythmjs/rhythm) on Bun. It serves
a small HTML page that loads Scalar from a CDN and points it at an OpenAPI document URL. It does not generate or serve
the document: pair it with [`@rhythmjs/openapi`](../openapi), or point `url` at any other source.

## Install

```sh
bun add @rhythmjs/scalar @rhythmjs/http @rhythmjs/rhythm @rhythmjs/router
```

`@rhythmjs/http` is a peer: the page is mounted with `@rhythmjs/http/mount`.

## Usage

```ts
import { Rhythm } from "@rhythmjs/rhythm";
import { openapiModule } from "@rhythmjs/openapi/module";
import { scalarModule } from "@rhythmjs/scalar";

const app = new Rhythm<RhythmHttpContext>()
  .register(openapiModule.forRoot({ document: config })) // GET /openapi.json
  .register(scalarModule.forRoot({ theme: "purple" })) // GET /docs
  .use(users.middleware());
```

`scalarModule.forRoot(options?)` answers `GET` on its `path` only (an exact match) and leaves every other request to
the app. The page is built once when the module is created. Register it before any catch-all middleware.

| Option  | Default         | Meaning                                                                                                             |
| ------- | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `path`  | `/docs`         | where the page is served                                                                                            |
| `url`   | `/openapi.json` | the document the page loads (HTML-escaped into the page); exclusive with `sources`                                  |
| `title` | `API Reference` | the page title (HTML-escaped)                                                                                       |
| `nonce` |                 | a Content-Security-Policy nonce set on every script tag                                                             |
| `cdn`   |                 | your own copy of Scalar: its package base URL (http(s) or root-relative), served from `/dist/browser/standalone.js` |

| `sources` | | several documents in one page, `{ url, title?, slug?, default? }[]`, listed in Scalar's document dropdown; exclusive with `url` |

Every other option is Scalar's own configuration, passed through as it is: `theme`, `layout`, `darkMode`,
`hideModels`, `customCss`, `withDefaultFonts`, and the rest of
[Scalar's options](https://scalar.com/products/api-references/configuration).

## Several documents

`sources` puts several documents in one page. Each group module can keep its own `openapiModule` (and so its own
document and scope), while one UI at the top of the app lists them all:

```ts
new Rhythm<RhythmHttpContext>()
  .register(apiModule) // registers openapiModule at /api/v1/openapi.json
  .register(platformModule) // registers openapiModule at /api/platform/openapi.json
  .register(
    scalarModule.forRoot({
      sources: [
        { url: "/api/v1/openapi.json", title: "Public API" },
        { url: "/api/platform/openapi.json", title: "Platform API" },
      ],
    }),
  );
```

By default Scalar loads from jsDelivr at an exact pinned version with a Subresource Integrity hash, so a moved or
compromised CDN file is refused by the browser. A custom `cdn` drops the built-in hash, because it belongs to the
default file. The browser needs network access to render the page.
