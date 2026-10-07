import { documented } from "@rhythmjs/openapi/generate";
import { apiBody } from "@rhythmjs/openapi/body";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiParam } from "@rhythmjs/openapi/param";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiTags } from "@rhythmjs/openapi/tags";
import { RhythmRouter } from "@rhythmjs/router";
import { z } from "zod";

const User = z.object({ id: z.string(), name: z.string() });
const CreateUser = z.object({ name: z.string().min(1) });
const UserParams = z.object({ id: z.string() });

export const apiController = documented(new RhythmRouter())
  .use(apiTags("users"))
  .get(
    "/api/v1/users",
    apiOperation({ summary: "List users", operationId: "listUsers" }),
    apiResponse(200, { description: "All users", schema: z.array(User) }),
    (ctx) => {
      ctx.json([{ id: "1", name: "Ada" }]);
    },
  )
  .get(
    "/api/v1/users/:id",
    apiParam(UserParams),
    apiOperation({ summary: "Get a user", operationId: "getUser" }),
    apiResponse(200, { description: "The user", schema: User }),
    (ctx) => {
      ctx.json({ id: ctx.params.id, name: "Ada" });
    },
  )
  .post(
    "/api/v1/users",
    apiBody(CreateUser),
    apiOperation({ summary: "Create a user", operationId: "createUser" }),
    apiResponse(201, { description: "Created", schema: User }),
    (ctx) => {
      ctx.json({ id: "2", ...ctx.valid.body }, 201);
    },
  );
