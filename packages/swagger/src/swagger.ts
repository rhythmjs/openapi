import { mount } from "@rhythmjs/http/mount";
import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";

export interface SwaggerSource {
  url: string;
  title?: string;
}

export interface SwaggerOptions {
  path?: string;
  url?: string;
  sources?: readonly SwaggerSource[];
  pageTitle?: string;
  swaggerOptions?: Record<string, unknown>;
  cdn?: string;
  nonce?: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function jsValue(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(" ", "\\u2028").replaceAll(" ", "\\u2029");
}

function checkCdn(cdn: string): string {
  if (!/^(https?:)?\/\/|^\//.test(cdn)) {
    throw new TypeError(`swaggerModule cdn must be an http(s) URL or a root-relative path, got "${cdn}"`);
  }
  return cdn.replace(/\/+$/, "");
}

const SWAGGER_BASE = "https://unpkg.com/swagger-ui-dist@5.33.0";
const SWAGGER_CSS_SRI = "sha384-Ov4/wv3j2bmct8cDc5X4ngJZohVPzEmc6uDPH8WeljUxO5vtoykvMEfbu9Vh6RaW";
const SWAGGER_JS_SRI = "sha384-YDALVcy8kj8yltLBVi1vBiBAUqdxvus673gM8XKwiy6aDUJFXivF/KCufekjYbVf";
const SWAGGER_PRESET_SRI = "sha384-My2aDM4r2Mbm3ybHcubKm9O9U8FEjvF/O5nGvE9YK5dzqOTbWEKa79RPJ1krdMaF";

function swaggerPage(
  target: { url: string } | { sources: readonly SwaggerSource[] },
  title: string,
  cdn: string | undefined,
  nonce: string | undefined,
  swaggerOptions: Record<string, unknown>,
): string {
  const nonceAttr = nonce === undefined ? "" : ` nonce="${escapeHtml(nonce)}"`;
  const base = cdn === undefined ? SWAGGER_BASE : escapeHtml(checkCdn(cdn));
  const cssIntegrity = cdn === undefined ? ` integrity="${SWAGGER_CSS_SRI}"` : "";
  const jsIntegrity = cdn === undefined ? ` integrity="${SWAGGER_JS_SRI}"` : "";
  const extra = Object.keys(swaggerOptions).length > 0 ? `...${jsValue(swaggerOptions)}, ` : "";
  const multiple = "sources" in target;
  const presetIntegrity = cdn === undefined ? ` integrity="${SWAGGER_PRESET_SRI}"` : "";
  const presetScript = multiple
    ? `\n    <script src="${base}/swagger-ui-standalone-preset.js"${presetIntegrity} crossorigin="anonymous"${nonceAttr}></script>`
    : "";
  const definition = multiple
    ? `urls: ${jsValue(target.sources.map((source) => ({ url: source.url, name: source.title ?? source.url })))}, presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset], layout: "StandaloneLayout"`
    : `url: ${jsValue(target.url)}`;
  return `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${base}/swagger-ui.css"${cssIntegrity} crossorigin="anonymous" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${base}/swagger-ui-bundle.js"${jsIntegrity} crossorigin="anonymous"${nonceAttr}></script>${presetScript}
    <script${nonceAttr}>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ ${extra}${definition}, dom_id: "#swagger-ui" });
      };
    </script>
  </body>
</html>`;
}

export const swaggerModule = {
  forRoot(options: SwaggerOptions = {}) {
    const { path = "/docs", url, sources, pageTitle = "API Reference", swaggerOptions = {}, cdn, nonce } = options;
    if (url !== undefined && sources !== undefined) {
      throw new TypeError("swaggerModule takes either url or sources, not both");
    }
    const page = swaggerPage(
      sources === undefined ? { url: url ?? "/openapi.json" } : { sources },
      pageTitle,
      cdn,
      nonce,
      swaggerOptions,
    );
    return new Rhythm<RhythmHttpContext>({ type: "module", name: "swagger" }).use(
      mount(path, async (ctx, next) => {
        if (ctx.request.method !== "GET") {
          await next();
          return;
        }
        ctx.html(page);
      }),
    );
  },
};
