import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { OpenAPIObject } from "../types/types";
import type { OpenAPIConfig } from "../document/document";
import { generate, type GenerateOptions, type RouterSource } from "../generate/generate";

export interface ApiDocumentOptions extends GenerateOptions {
  path?: string;
  router: RouterSource;
  config: OpenAPIConfig;
}

export function apiDocument(options: ApiDocumentOptions): Middleware<RhythmHttpContext> {
  const path = options.path ?? "/openapi.json";
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
    ctx.json(await cached);
  };
}

export interface ApiReferenceOptions {
  path?: string;
  specUrl?: string;
  ui?: "scalar" | "swagger";
  title?: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function jsString(value: string): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

const SCALAR_SRC = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.3/dist/browser/standalone.js";
const SCALAR_SRI = "sha384-HWi/QCSPi64AQ0xBXFGDk+7gmvZ4hJ/7sZMIXqWVz6Ikb6+Cxej/hWKaomOStyFb";
const SWAGGER_BASE = "https://unpkg.com/swagger-ui-dist@5.33.0";
const SWAGGER_CSS_SRI = "sha384-Ov4/wv3j2bmct8cDc5X4ngJZohVPzEmc6uDPH8WeljUxO5vtoykvMEfbu9Vh6RaW";
const SWAGGER_JS_SRI = "sha384-YDALVcy8kj8yltLBVi1vBiBAUqdxvus673gM8XKwiy6aDUJFXivF/KCufekjYbVf";

function scalarPage(specUrl: string, title: string): string {
  return `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="${escapeHtml(specUrl)}"></script>
    <script src="${SCALAR_SRC}" integrity="${SCALAR_SRI}" crossorigin="anonymous"></script>
  </body>
</html>`;
}

function swaggerPage(specUrl: string, title: string): string {
  return `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${SWAGGER_BASE}/swagger-ui.css" integrity="${SWAGGER_CSS_SRI}" crossorigin="anonymous" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_BASE}/swagger-ui-bundle.js" integrity="${SWAGGER_JS_SRI}" crossorigin="anonymous"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ url: ${jsString(specUrl)}, dom_id: "#swagger-ui" });
      };
    </script>
  </body>
</html>`;
}

export function apiReference(options: ApiReferenceOptions = {}): Middleware<RhythmHttpContext> {
  const path = options.path ?? "/docs";
  const specUrl = options.specUrl ?? "/openapi.json";
  const title = escapeHtml(options.title ?? "API Reference");
  const page = options.ui === "swagger" ? swaggerPage(specUrl, title) : scalarPage(specUrl, title);
  return async (ctx, next) => {
    if (ctx.request.method !== "GET" || new URL(ctx.request.url).pathname !== path) {
      await next();
      return;
    }
    ctx.html(page);
  };
}
