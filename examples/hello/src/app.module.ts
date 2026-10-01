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

export const appModule = new Rhythm<RhythmHttpContext>({ name: "app", type: "module" })
  .provide(() => ({ appService }))
  .register(openapiModule.forRoot({ document: openapiConfig, path: "/api/openapi.json" }))
  .register(scalarModule.forRoot({ path: "/api/docs", url: "/api/openapi.json", title: "Hello API", theme: "purple" }))
  .register(swaggerModule.forRoot({ path: "/api/swagger", url: "/api/openapi.json", title: "Hello API" }))
  .use(appController.middleware())
  .use((ctx) => {
    ctx.response.status = 404;
    ctx.response.headers.set("content-type", "application/json");
    ctx.response.body = JSON.stringify({ success: false, status: 404, message: "Not Found" });
  });
