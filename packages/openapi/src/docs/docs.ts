import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { OpenAPIObject } from "../types/types";
import type { OpenAPIConfig } from "../document/document";
import { generate, type GenerateOptions, type RouterSource } from "../generate/generate";

export interface ApiDocumentOptions extends GenerateOptions {
  path?: string;
  format?: "json" | "yaml";
  router: RouterSource;
  config: OpenAPIConfig;
}

export function apiDocument(options: ApiDocumentOptions): Middleware<RhythmHttpContext> {
  const format = options.format ?? (/\.ya?ml$/.test(options.path ?? "") ? "yaml" : "json");
  if (format === "yaml" && typeof Bun.YAML?.stringify !== "function") {
    throw new Error('apiDocument format "yaml" needs Bun\'s built-in YAML support (Bun 1.2.21 or newer)');
  }
  const path = options.path ?? (format === "yaml" ? "/openapi.yaml" : "/openapi.json");
  let cached: Promise<OpenAPIObject> | undefined;
  return async (ctx, next) => {
    if (ctx.request.method !== "GET" || new URL(ctx.request.url).pathname !== path) {
      await next();
      return;
    }
    if (!cached) {
      const pending = generate(options.router, options.config, options);
      pending.catch(() => {
        if (cached === pending) cached = undefined;
      });
      cached = pending;
    }
    const document = await cached;
    if (format === "yaml") {
      ctx.response.headers.set("content-type", "application/yaml; charset=utf-8");
      ctx.response.body = Bun.YAML.stringify(document, null, 2);
      return;
    }
    ctx.json(document);
  };
}

export type ScalarTheme =
  | "alternate"
  | "default"
  | "moon"
  | "purple"
  | "solarized"
  | "bluePlanet"
  | "deepSpace"
  | "saturn"
  | "kepler"
  | "mars"
  | "laserwave"
  | "none";

export interface ScalarOptions {
  theme?: ScalarTheme;
  layout?: "modern" | "classic";
  darkMode?: boolean;
  forceDarkModeState?: "dark" | "light";
  hideDarkModeToggle?: boolean;
  hideDownloadButton?: boolean;
  hideModels?: boolean;
  hideSearch?: boolean;
  showSidebar?: boolean;
  searchHotKey?: string;
  withDefaultFonts?: boolean;
  customCss?: string;
  [option: string]: unknown;
}

export type SwaggerOptions = Record<string, unknown>;

export interface ApiReferenceOptions {
  path?: string;
  specUrl?: string;
  ui?: "scalar" | "swagger";
  title?: string;
  scalar?: ScalarOptions;
  swagger?: SwaggerOptions;
  cdn?: string;
  nonce?: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function jsValue(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function nonceAttr(nonce: string | undefined): string {
  return nonce === undefined ? "" : ` nonce="${escapeHtml(nonce)}"`;
}

function checkCdn(cdn: string | undefined): string | undefined {
  if (cdn === undefined) return undefined;
  if (!/^(https?:)?\/\/|^\//.test(cdn)) {
    throw new TypeError(`apiReference cdn must be an http(s) URL or a root-relative path, got "${cdn}"`);
  }
  return cdn.replace(/\/+$/, "");
}

const SCALAR_SRC = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.3/dist/browser/standalone.js";
const SCALAR_SRI = "sha384-HWi/QCSPi64AQ0xBXFGDk+7gmvZ4hJ/7sZMIXqWVz6Ikb6+Cxej/hWKaomOStyFb";
const SWAGGER_BASE = "https://unpkg.com/swagger-ui-dist@5.33.0";
const SWAGGER_CSS_SRI = "sha384-Ov4/wv3j2bmct8cDc5X4ngJZohVPzEmc6uDPH8WeljUxO5vtoykvMEfbu9Vh6RaW";
const SWAGGER_JS_SRI = "sha384-YDALVcy8kj8yltLBVi1vBiBAUqdxvus673gM8XKwiy6aDUJFXivF/KCufekjYbVf";

function scalarPage(specUrl: string, title: string, options: ApiReferenceOptions): string {
  const cdn = checkCdn(options.cdn);
  const config = options.scalar && Object.keys(options.scalar).length > 0 ? JSON.stringify(options.scalar) : undefined;
  const configAttr = config === undefined ? "" : ` data-configuration="${escapeHtml(config)}"`;
  const nonce = nonceAttr(options.nonce);
  const script =
    cdn === undefined
      ? `<script src="${SCALAR_SRC}" integrity="${SCALAR_SRI}" crossorigin="anonymous"${nonce}></script>`
      : `<script src="${escapeHtml(cdn)}/dist/browser/standalone.js" crossorigin="anonymous"${nonce}></script>`;
  return `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="${escapeHtml(specUrl)}"${configAttr}${nonce}></script>
    ${script}
  </body>
</html>`;
}

function swaggerPage(specUrl: string, title: string, options: ApiReferenceOptions): string {
  const cdn = checkCdn(options.cdn);
  const nonce = nonceAttr(options.nonce);
  const base = cdn === undefined ? SWAGGER_BASE : escapeHtml(cdn);
  const css = cdn === undefined ? ` integrity="${SWAGGER_CSS_SRI}"` : "";
  const js = cdn === undefined ? ` integrity="${SWAGGER_JS_SRI}"` : "";
  const extra = options.swagger && Object.keys(options.swagger).length > 0 ? `...${jsValue(options.swagger)}, ` : "";
  return `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${base}/swagger-ui.css"${css} crossorigin="anonymous" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${base}/swagger-ui-bundle.js"${js} crossorigin="anonymous"${nonce}></script>
    <script${nonce}>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ ${extra}url: ${jsValue(specUrl)}, dom_id: "#swagger-ui" });
      };
    </script>
  </body>
</html>`;
}

export function apiReference(options: ApiReferenceOptions = {}): Middleware<RhythmHttpContext> {
  const path = options.path ?? "/docs";
  const specUrl = options.specUrl ?? "/openapi.json";
  const title = escapeHtml(options.title ?? "API Reference");
  const page = options.ui === "swagger" ? swaggerPage(specUrl, title, options) : scalarPage(specUrl, title, options);
  return async (ctx, next) => {
    if (ctx.request.method !== "GET" || new URL(ctx.request.url).pathname !== path) {
      await next();
      return;
    }
    ctx.html(page);
  };
}
