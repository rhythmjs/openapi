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

function scalarPage(specUrl: string, title: string): string {
  return `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="${specUrl}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
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
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ url: "${specUrl}", dom_id: "#swagger-ui" });
      };
    </script>
  </body>
</html>`;
}

export function apiReference(options: ApiReferenceOptions = {}): Middleware<RhythmHttpContext> {
  const path = options.path ?? "/docs";
  const specUrl = escapeHtml(options.specUrl ?? "/openapi.json");
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
