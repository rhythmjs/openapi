import { renderApiReference, type HtmlRenderingConfiguration } from "@scalar/client-side-rendering";
import { RhythmRouter } from "@rhythmjs/router";
import { html } from "@rhythmjs/router/response";

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
    return new RhythmRouter({ name: "scalar" }).get(path, (ctx) => {
      html(ctx, page);
    });
  },
};
