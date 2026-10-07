import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { scalarModule } from "@rhythmjs/scalar";
import { swaggerModule } from "@rhythmjs/swagger";
import { Rhythm, decorate, mount } from "@rhythmjs/rhythm";
import { appController } from "./app.controller";
import { appService } from "./app.service";

const openapiConfig = defineDocument({
  info: { title: "Hello API", version: "1.0.0" },
  securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
});

export const appModule = new Rhythm({ name: "app" })
  .register(decorate(() => ({ appService })))
  .use(mount(openapiModule.forRoot({ document: openapiConfig, path: "/api/openapi.json" })))
  .use(
    mount(
      scalarModule.forRoot({ path: "/api/docs", url: "/api/openapi.json", pageTitle: "Hello API", theme: "purple" }),
    ),
  )
  .use(mount(swaggerModule.forRoot({ path: "/api/swagger", url: "/api/openapi.json", pageTitle: "Hello API" })))
  .use(mount(appController))
  .use((ctx) => {
    if (ctx.response.body === null) ctx.json({ success: false, status: 404, message: "Not Found" }, 404);
  });
