import { apiBody, type Validated } from "@rhythmjs/openapi/body";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiBearerAuth, apiNoSecurity } from "@rhythmjs/openapi/security";
import { apiTags } from "@rhythmjs/openapi/tags";
import { RhythmRouter } from "@rhythmjs/router";
import { z } from "zod";

const Tenant = z.object({ id: z.string(), name: z.string() });
const CreateTenant = z.object({ name: z.string().min(1) });

export const platformController = new RhythmRouter({ prefix: "/api/platform" })
  .use(apiTags("platform"))
  .get(
    "/health",
    apiNoSecurity(),
    apiOperation({ summary: "Liveness probe", operationId: "getHealth" }),
    apiResponse(200, { description: "The platform is up", schema: z.object({ status: z.literal("ok") }) }),
    (ctx) => {
      ctx.json({ status: "ok" });
    },
  )
  .use(apiBearerAuth())
  .get(
    "/tenants",
    apiOperation({ summary: "List tenants", operationId: "listTenants" }),
    apiResponse(200, { description: "All tenants", schema: z.array(Tenant) }),
    apiResponse(401, { description: "Missing or invalid bearer token" }),
    (ctx) => {
      ctx.json([{ id: "t1", name: "Acme" }]);
    },
  )
  .post<Validated<"body", typeof CreateTenant>>(
    "/tenants",
    apiBody(CreateTenant),
    apiOperation({ summary: "Create a tenant", operationId: "createTenant" }),
    apiResponse(201, { description: "Created", schema: Tenant }),
    apiResponse(401, { description: "Missing or invalid bearer token" }),
    (ctx) => {
      ctx.json({ id: "t2", ...ctx.valid.body }, 201);
    },
  );
