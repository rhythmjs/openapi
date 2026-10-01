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

const sourceKey = Symbol.for("rhythm.source");

type Source = { readonly entries?: unknown; readonly middlewares?: readonly Function[] };

function collectRouters(app: Source, found = new Set<RouterSource>(), seen = new Set<Source>()): Set<RouterSource> {
  if (seen.has(app)) return found;
  seen.add(app);
  for (const middleware of app.middlewares ?? []) {
    const source = (middleware as { [sourceKey]?: Source })[sourceKey];
    if (!source) continue;
    if (Array.isArray(source.entries)) found.add(source as RouterSource);
    else collectRouters(source, found, seen);
  }
  return found;
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
                "openapiModule documents the app it is registered in: add it with app.register(openapiModule.forRoot(...)), not app.use(module.middleware())",
              ),
            );
          }
          const pending = generate([...collectRouters(scope)], config, generateOptions);
          pending.catch(() => {
            if (cached === pending) cached = undefined;
          });
          cached = pending;
        }
        return cached;
      },
    };

    const module = new Rhythm<RhythmHttpContext>({ type: "module", name: "openapi" })
      .provide(() => ({ openapiService }))
      .use(
        mount(path, async (ctx, next) => {
          if (ctx.request.method !== "GET") {
            await next();
            return;
          }
          return Response.json(await openapiService.document());
        }),
      );
    return module;
  },
};
