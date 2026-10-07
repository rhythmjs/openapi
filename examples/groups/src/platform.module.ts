import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { platformController } from "./platform.controller";

const document = defineDocument({
  info: { title: "Platform API", version: "1.0.0", description: "Internal endpoints for operating the platform." },
  servers: [{ url: "/api/platform" }],
  securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
});

export const platformModule = new Rhythm({ name: "platform" })
  .use(mount(openapiModule.forRoot({ document, path: "/api/platform/openapi.json" })))
  .use(mount(platformController));
