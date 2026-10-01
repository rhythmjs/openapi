import { renderApiReference, type HtmlRenderingConfiguration } from "@scalar/client-side-rendering";
import { mount } from "@rhythmjs/http/mount";
import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";

export type ScalarOptions = Partial<HtmlRenderingConfiguration> & { path?: string };

export const scalarModule = {
  forRoot(options: ScalarOptions = {}) {
    const { path = "/docs", pageTitle, cdn, nonce, bundle, ...config } = options;
    const page = renderApiReference({
      config: {
        ...config,
        ...(config.url === undefined && !config.sources && !config.content ? { url: "/openapi.json" } : {}),
      },
      pageTitle,
      cdn,
      nonce,
      bundle,
    });
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
