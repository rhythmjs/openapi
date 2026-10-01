import { defineDocument } from "@rhythmjs/openapi/document";
import { apiDocument, apiReference } from "@rhythmjs/openapi/docs";
import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { appController } from "./app.controller";
import { appService } from "./app.service";

const openapiConfig = defineDocument({ info: { title: "Hello API", version: "1.0.0" } });

export const appModule = new Rhythm<RhythmHttpContext>({ name: "app", type: "module" })
  .provide(() => ({ appService }))
  .use(apiDocument({ router: appController, config: openapiConfig }))
  .use(apiDocument({ router: appController, config: openapiConfig, format: "yaml" }))
  .use(apiReference({ title: "Hello API", specUrl: "/openapi.yaml", scalar: { theme: "purple" } }))
  .use(appController.middleware())
  .use((ctx) => {
    ctx.response.status = 404;
    ctx.response.headers.set("content-type", "application/json");
    ctx.response.body = JSON.stringify({ success: false, status: 404, message: "Not Found" });
  });
