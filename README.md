# openapi

OpenAPI 3.1 for [Rhythm](https://github.com/rhythmjs/rhythm), the Bun-native backend framework: spec generation in
one package, reference UIs in two others.

- **[`packages/openapi`](./packages/openapi)**: `@rhythmjs/openapi`, single-purpose middlewares
  (`apiBody`, `apiResponse`, `apiTags`, …) that document and validate routes, a generator that turns the mounted
  routers into an OpenAPI 3.1 document, and `openapiModule`, which serves it as JSON.
- **[`packages/scalar`](./packages/scalar)**: `@rhythmjs/scalar`, the [Scalar](https://scalar.com) API reference page,
  pointed at any OpenAPI document URL.
- **[`packages/swagger`](./packages/swagger)**: `@rhythmjs/swagger`, the
  [Swagger UI](https://swagger.io/tools/swagger-ui/) page, pointed at any OpenAPI document URL.

The UI packages do not depend on the generator: they load a document by URL, so they work with
`openapiModule` or any other source.

## Examples

- **[`examples/hello`](./examples/hello)**: a controller using the documenting middlewares, with `openapiModule`
  serving the spec and both Scalar and Swagger UI rendering it.
- **[`examples/groups`](./examples/groups)**: an app split into an `api` and a `platform` module, each with its
  own `openapiModule` and document, with Scalar and Swagger UI at the top level listing both.

## Development

Bun workspaces, `bun test`, `bun build`, oxlint, prettier.

```sh
bun install
bun run check   # prettier, oxlint, tsc
bun test
bun run build
```
