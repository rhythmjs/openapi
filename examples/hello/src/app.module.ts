import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { scalarModule } from "@rhythmjs/scalar";
import { swaggerModule } from "@rhythmjs/swagger";
import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { appController } from "./app.controller";
import { appService } from "./app.service";

const openapiConfig = defineDocument({
  info: { title: "Hello API", version: "1.0.0" },
  securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
});

const baseModule = new Rhythm<RhythmHttpContext, { appService: typeof appService }>({ name: "app", type: "module" });
baseModule.context.appService = appService;

export const appModule = baseModule
  .register(openapiModule.forRoot({ document: openapiConfig, path: "/api/openapi.json" }))
  .register(
    scalarModule.forRoot({ path: "/api/docs", url: "/api/openapi.json", pageTitle: "Hello API", theme: "purple" }),
  )
  .register(swaggerModule.forRoot({ path: "/api/swagger", url: "/api/openapi.json", pageTitle: "Hello API" }))
  .use(appController.middleware())
  .use((ctx) => {
    ctx.json({ success: false, status: 404, message: "Not Found" }, 404);
  });
