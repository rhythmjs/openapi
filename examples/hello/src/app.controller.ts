import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiResponse } from "@rhythmjs/openapi/response";
import { RhythmRouter } from "@rhythmjs/router";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { appService } from "./app.service";

export type AppContext = RhythmHttpContext & {
  appService: typeof appService;
};

export const appController = new RhythmRouter<AppContext>().get(
  "/",
  apiOperation({ summary: "Say hello", operationId: "getHello" }),
  apiResponse(200, { description: "A greeting", content: { "text/plain": { schema: { type: "string" } } } }),
  (ctx) => {
    ctx.response.headers.set("content-type", "text/plain");
    ctx.response.body = ctx.appService.getHello();
  },
);
