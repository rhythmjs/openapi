import { mount } from "@rhythmjs/http/mount";
import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";

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

export interface ScalarConfiguration {
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

export interface ScalarSource {
  url: string;
  title?: string;
  slug?: string;
  default?: boolean;
}

export interface ScalarOptions extends ScalarConfiguration {
  path?: string;
  url?: string;
  sources?: readonly ScalarSource[];
  title?: string;
  cdn?: string;
  nonce?: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function checkCdn(cdn: string): string {
  if (!/^(https?:)?\/\/|^\//.test(cdn)) {
    throw new TypeError(`scalarModule cdn must be an http(s) URL or a root-relative path, got "${cdn}"`);
  }
  return cdn.replace(/\/+$/, "");
}

const SCALAR_SRC = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.3/dist/browser/standalone.js";
const SCALAR_SRI = "sha384-HWi/QCSPi64AQ0xBXFGDk+7gmvZ4hJ/7sZMIXqWVz6Ikb6+Cxej/hWKaomOStyFb";

function scalarPage(
  url: string | undefined,
  title: string,
  cdn: string | undefined,
  nonce: string | undefined,
  configuration: ScalarConfiguration,
): string {
  const configAttr =
    Object.keys(configuration).length > 0 ? ` data-configuration="${escapeHtml(JSON.stringify(configuration))}"` : "";
  const nonceAttr = nonce === undefined ? "" : ` nonce="${escapeHtml(nonce)}"`;
  const script =
    cdn === undefined
      ? `<script src="${SCALAR_SRC}" integrity="${SCALAR_SRI}" crossorigin="anonymous"${nonceAttr}></script>`
      : `<script src="${escapeHtml(checkCdn(cdn))}/dist/browser/standalone.js" crossorigin="anonymous"${nonceAttr}></script>`;
  return `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference"${url === undefined ? "" : ` data-url="${escapeHtml(url)}"`}${configAttr}${nonceAttr}></script>
    ${script}
  </body>
</html>`;
}

export const scalarModule = {
  forRoot(options: ScalarOptions = {}) {
    const { path = "/docs", url, sources, title = "API Reference", cdn, nonce, ...configuration } = options;
    if (url !== undefined && sources !== undefined) {
      throw new TypeError("scalarModule takes either url or sources, not both");
    }
    const page = scalarPage(
      sources === undefined ? (url ?? "/openapi.json") : undefined,
      title,
      cdn,
      nonce,
      sources === undefined ? configuration : { ...configuration, sources },
    );
    return new Rhythm<RhythmHttpContext>({ type: "module", name: "scalar" }).use(
      mount(path, async (ctx, next) => {
        if (ctx.request.method !== "GET") {
          await next();
          return;
        }
        return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
      }),
    );
  },
};
