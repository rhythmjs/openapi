import { apiBody, type Validated } from "@rhythmjs/openapi/body";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiParam } from "@rhythmjs/openapi/param";
import { apiQuery } from "@rhythmjs/openapi/query";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiBearerAuth } from "@rhythmjs/openapi/security";
import { apiTags } from "@rhythmjs/openapi/tags";
import { RhythmRouter } from "@rhythmjs/router";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { z } from "zod";
import type { appService } from "./app.service";

export type AppContext = RhythmHttpContext & {
  appService: typeof appService;
};

const Greeting = z.object({ message: z.string() });
const GreetQuery = z.object({ name: z.string().default("World") });
const GreetParams = z.object({ name: z.string() });
const CustomGreeting = z.object({ name: z.string().min(1), message: z.string().min(1) });

export const appController = new RhythmRouter<AppContext>()
  .use(apiTags("greetings"))
  .use(async (ctx, next) => {
    ctx.response.headers.set("x-request-id", crypto.randomUUID());
    await next();
  })
  .get(
    "/",
    apiOperation({ summary: "Say hello", operationId: "getHello" }),
    apiResponse(200, { description: "A greeting", content: { "text/plain": { schema: { type: "string" } } } }),
    (ctx) => {
      ctx.text(ctx.appService.getHello());
    },
  )
  .get<Validated<"query", typeof GreetQuery>>(
    "/greet",
    apiQuery(GreetQuery),
    apiOperation({ summary: "Greet by query string", operationId: "greetByQuery" }),
    apiResponse(200, { description: "A greeting", schema: Greeting }),
    (ctx) => {
      ctx.json({ message: ctx.appService.greet(ctx.valid.query.name) });
    },
  )
  .get(
    "/greet/:name",
    apiParam(GreetParams),
    apiOperation({ summary: "Greet by path parameter", operationId: "greetByParam" }),
    apiResponse(200, { description: "A greeting", schema: Greeting }),
    (ctx) => {
      ctx.json({ message: ctx.appService.greet(ctx.params.name) });
    },
  )

  .post<Validated<"body", typeof CustomGreeting>>(
    "/greet",
    apiBody(CustomGreeting),
    apiBearerAuth(),
    apiTags("admin"),
    apiOperation({ summary: "Create a custom greeting", operationId: "createGreeting" }),
    apiResponse(201, { description: "Created", schema: Greeting }),
    apiResponse(401, { description: "Missing or invalid bearer token" }),
    (ctx) => {
      const { name, message } = ctx.valid.body;
      ctx.json({ message: `${message}, ${name}!` }, 201);
    },
  );
