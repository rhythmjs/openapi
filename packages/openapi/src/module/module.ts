import { mount } from "@rhythmjs/http/mount";
import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { OpenAPIObject } from "../types/types";
import type { OpenAPIConfig } from "../document/document";
import { generate, type GenerateOptions, type RouterSource } from "../generate/generate";

export interface OpenapiOptions extends GenerateOptions {
  document: OpenAPIConfig;
  path?: string;
}

export interface OpenapiService {
  document(): Promise<OpenAPIObject>;
}

function isRouter(source: object): source is RouterSource {
  return Array.isArray((source as { entries?: unknown }).entries);
}

export const openapiModule = {
  forRoot(options: OpenapiOptions) {
    const { document: config, path = "/openapi.json", ...generateOptions } = options;

    let cached: Promise<OpenAPIObject> | undefined;
    const openapiService: OpenapiService = {
      document() {
        if (!cached) {
          const scope = module.parent;
          if (!scope) {
            return Promise.reject(
              new Error(
                "openapiModule documents the app it is registered in: add it with app.register(openapiModule.forRoot(...)) or app.use(module.middleware())",
              ),
            );
          }
          const pending = generate(scope.sources.filter(isRouter), config, generateOptions);
          pending.catch(() => {
            if (cached === pending) cached = undefined;
          });
          cached = pending;
        }
        return cached;
      },
    };

    const module = new Rhythm<RhythmHttpContext, { openapiService: OpenapiService }>({
      type: "module",
      name: "openapi",
    });
    module.context.openapiService = openapiService;
    return module.use(
      mount(path, async (ctx, next) => {
        if (ctx.request.method !== "GET") {
          await next();
          return;
        }
        return Response.json(await openapiService.document());
      }),
    );
  },
};
