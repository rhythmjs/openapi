import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { apiController } from "./api.controller";

const document = defineDocument({
  info: { title: "Public API", version: "1.0.0", description: "Endpoints for API consumers." },
  servers: [{ url: "/api/v1" }],
});

export const apiModule = new Rhythm<RhythmHttpContext>({ name: "api", type: "module" })
  .register(openapiModule.forRoot({ document, path: "/api/v1/openapi.json" }))
  .use(apiController.middleware());
