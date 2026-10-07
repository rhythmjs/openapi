import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { apiController } from "./api.controller";

const document = defineDocument({
  info: { title: "Public API", version: "1.0.0", description: "Endpoints for API consumers." },
  servers: [{ url: "/api/v1" }],
});

export const apiModule = new Rhythm({ name: "api" })
  .use(mount(openapiModule.forRoot({ document, path: "/api/v1/openapi.json" })))
  .use(mount(apiController));
