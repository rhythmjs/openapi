import { Pipeline } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import type { OpenAPIObject } from "../types/types";
import type { OpenAPIConfig } from "../document/document";
import { generate, isRouterSource, type GenerateOptions, type RouterSource } from "../generate/generate";

export interface OpenapiOptions extends GenerateOptions {
  document: OpenAPIConfig;
  path?: string;
}

export interface OpenapiService {
  document(): Promise<OpenAPIObject>;
}

function routersIn(sources: readonly object[], seen = new Set<object>()): RouterSource[] {
  const routers: RouterSource[] = [];
  for (const source of sources) {
    if (seen.has(source)) continue;
    seen.add(source);
    if (isRouterSource(source)) routers.push(source);
    if (source instanceof Pipeline) routers.push(...routersIn(source.sources, seen));
  }
  return routers;
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
                "openapiModule documents the app it is registered in: add it with app.use(mount(openapiModule.forRoot(...)))",
              ),
            );
          }
          const pending = generate(routersIn(scope.sources), config, generateOptions);
          pending.catch(() => {
            if (cached === pending) cached = undefined;
          });
          cached = pending;
        }
        return cached;
      },
    };

    const module = new RhythmRouter({ name: "openapi" }).get(path, async (ctx) => {
      ctx.json(await openapiService.document());
    });
    return Object.assign(module, { openapiService });
  },
};
