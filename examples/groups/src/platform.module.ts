import { defineDocument } from "@rhythmjs/openapi/document";
import { openapiModule } from "@rhythmjs/openapi/module";
import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { platformController } from "./platform.controller";

const document = defineDocument({
  info: { title: "Platform API", version: "1.0.0", description: "Internal endpoints for operating the platform." },
  servers: [{ url: "/api/platform" }],
  securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
});

export const platformModule = new Rhythm<RhythmHttpContext>({ name: "platform", type: "module" })
  .register(openapiModule.forRoot({ document, path: "/api/platform/openapi.json" }))
  .use(platformController.middleware());
