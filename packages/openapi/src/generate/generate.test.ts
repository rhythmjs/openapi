import { describe, expect, test } from "bun:test";
import { RhythmRouter } from "@rhythmjs/router";
import { z } from "zod";
import { apiBody } from "../body/body";
import { apiQuery } from "../query/query";
import { apiParam } from "../param/param";
import { apiOperation } from "../operation/operation";
import { apiResponse } from "../response/response";
import { apiTags } from "../tags/tags";
import { apiBearerAuth, apiNoSecurity } from "../security/security";
import { apiExclude } from "../exclude/exclude";
import { apiExtension } from "../extension/extension";
import { defineDocument } from "../document/document";
import { documented, generate } from "./generate";
import type { OpenAPIObject, OperationObject, ParameterObject } from "../types/types";

const config = defineDocument({
  info: { title: "Test API", version: "1.0.0" },
  securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
});

const ok = (ctx: { json(data: unknown): void }): void => {
  ctx.json({ ok: true });
};

const op = (doc: OpenAPIObject, path: string, method: "get" | "post"): OperationObject => {
  const operation = doc.paths?.[path]?.[method];
  if (!operation) throw new Error(`missing ${method.toUpperCase()} ${path} in generated document`);
  return operation;
};

describe("generate", () => {
  test("builds a 3.1 document from a documented router", async () => {
    const user = z.object({ id: z.string(), name: z.string() });
    const createUser = z.object({ name: z.string().min(1) });

    const router = documented(documented(new RhythmRouter()))
      .use(apiTags("users"))
      .post(
        "/api/users",
        apiOperation({ summary: "Create user", operationId: "createUser" }),
        apiBearerAuth(),
        apiBody(createUser),
        apiResponse(201, { description: "Created", schema: user }),
        apiResponse(400, { description: "Validation failed" }),
        ok,
      )
      .get(
        "/api/users/:id",
        apiParam(z.object({ id: z.string() })),
        apiResponse(200, { description: "The user", schema: user }),
        ok,
      );

    const doc = await generate(router, config, { includeUndocumented: true });

    expect(doc.openapi).toBe("3.1.2");
    expect(doc.info).toEqual({ title: "Test API", version: "1.0.0" });
    expect(doc.components?.securitySchemes).toEqual({ bearer: { type: "http", scheme: "bearer" } });

    const post = op(doc, "/api/users", "post");
    expect(post.tags).toEqual(["users"]);
    expect(post.summary).toBe("Create user");
    expect(post.operationId).toBe("createUser");
    expect(post.security).toEqual([{ bearer: [] }]);
    const bodySchema = (post.requestBody as { content: Record<string, { schema: Record<string, unknown> }> }).content[
      "application/json"
    ].schema;
    expect(bodySchema.type).toBe("object");
    expect(Object.keys(post.responses ?? {}).sort()).toEqual(["201", "400"]);

    const get = op(doc, "/api/users/{id}", "get");
    const params = get.parameters as ParameterObject[];
    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({ name: "id", in: "path", required: true, schema: { type: "string" } });
  });

  test("router-level fragments apply only to routes registered after them", async () => {
    const router = documented(new RhythmRouter()).get("/before", ok).use(apiTags("tagged")).get("/after", ok);

    const doc = await generate(router, config, { includeUndocumented: true });

    expect(op(doc, "/before", "get").tags).toBeUndefined();
    expect(op(doc, "/after", "get").tags).toEqual(["tagged"]);
  });

  test("expands query parameters with requiredness and overrides", async () => {
    const router = documented(new RhythmRouter()).get(
      "/search",
      apiQuery(z.object({ q: z.string(), limit: z.coerce.number().optional() }), {
        overrides: { q: { description: "Search text" }, limit: { deprecated: true } },
      }),
      ok,
    );

    const doc = await generate(router, config, { includeUndocumented: true });
    const params = op(doc, "/search", "get").parameters as ParameterObject[];

    const byName = Object.fromEntries(params.map((p) => [p.name, p]));
    expect(byName.q).toMatchObject({ in: "query", required: true, description: "Search text" });
    expect(byName.limit).toMatchObject({ in: "query", required: false, deprecated: true });
  });

  test("undocumented routes get a default response, and can be dropped via includeUndocumented", async () => {
    const router = documented(new RhythmRouter()).get("/health", ok);

    const doc = await generate(router, config, { includeUndocumented: true });
    expect(op(doc, "/health", "get").responses).toEqual({
      "200": { description: "Successful response" },
    });

    expect((await generate(router, config)).paths).toEqual({});
    const sparse = await generate(router, config, { includeUndocumented: false });
    expect(sparse.paths).toEqual({});
  });

  test("apiExclude removes a route; router-level apiExclude removes the routes after it", async () => {
    const router = documented(new RhythmRouter())
      .get("/public", ok)
      .get("/internal", apiExclude(), ok)
      .use(apiExclude())
      .get("/also-internal", ok);

    const doc = await generate(router, config, { includeUndocumented: true });

    expect(Object.keys(doc.paths ?? {})).toEqual(["/public"]);
  });

  test("apiNoSecurity overrides inherited security with an empty requirement", async () => {
    const router = documented(new RhythmRouter())
      .use(apiBearerAuth())
      .get("/private", ok)
      .get("/login", apiNoSecurity(), ok);

    const doc = await generate(router, config, { includeUndocumented: true });

    expect(op(doc, "/private", "get").security).toEqual([{ bearer: [] }]);
    expect(op(doc, "/login", "get").security).toEqual([]);
  });

  test("route-level security re-adds requirements after an inherited apiNoSecurity", async () => {
    const router = documented(new RhythmRouter())
      .use(apiNoSecurity())
      .get("/open", ok)
      .get("/locked", apiBearerAuth(), ok);

    const doc = await generate(router, config, { includeUndocumented: true });

    expect(op(doc, "/open", "get").security).toEqual([]);
    expect(op(doc, "/locked", "get").security).toEqual([{ bearer: [] }]);
  });

  test("operation extensions land on the operation object", async () => {
    const router = documented(new RhythmRouter()).get("/x", apiExtension("x-internal", true), ok);

    const doc = await generate(router, config, { includeUndocumented: true });

    expect(op(doc, "/x", "get")["x-internal"]).toBe(true);
  });

  test("hoists $defs from raw JSON Schemas into components.schemas and rewrites refs", async () => {
    const router = documented(new RhythmRouter()).get(
      "/user",
      apiResponse(200, {
        description: "A user",
        schema: {
          type: "object",
          properties: { user: { $ref: "#/$defs/User" } },
          $defs: { User: { type: "object", properties: { id: { type: "string" } } } },
        },
      }),
      ok,
    );

    const doc = await generate(router, config, { includeUndocumented: true });

    expect(doc.components?.schemas?.User).toEqual({ type: "object", properties: { id: { type: "string" } } });
    const response = op(doc, "/user", "get").responses?.["200"] as unknown as {
      content: Record<string, { schema: { properties: { user: { $ref: string } } } }>;
    };
    expect(response.content["application/json"].schema.properties.user.$ref).toBe("#/components/schemas/User");
  });

  test("request and response sides of a transforming schema document differently", async () => {
    const Count = z.object({ count: z.string().transform(Number).pipe(z.number()) });
    const router = documented(new RhythmRouter()).post(
      "/count",
      apiBody(Count),
      apiResponse(200, { description: "Counted", schema: Count }),
      ok,
    );

    const doc = await generate(router, config, { includeUndocumented: true });
    const operation = op(doc, "/count", "post");
    const request = operation.requestBody as {
      content: Record<string, { schema: { properties: Record<string, { type: string }> } }>;
    };
    const response = operation.responses?.["200"] as unknown as {
      content: Record<string, { schema: { properties: Record<string, { type: string }> } }>;
    };

    expect(request.content["application/json"].schema.properties.count.type).toBe("string");
    expect(response.content["application/json"].schema.properties.count.type).toBe("number");
  });

  test("wildcard segments become a {wildcard} template parameter path", async () => {
    const router = documented(new RhythmRouter()).get("/files/*", ok);

    const doc = await generate(router, config, { includeUndocumented: true });

    expect(Object.keys(doc.paths ?? {})).toEqual(["/files/{wildcard}"]);
  });

  test("root config passes through verbatim: servers, tags, webhooks, security, extensions", async () => {
    const full = defineDocument({
      info: { title: "Full", version: "2.0.0", summary: "Everything", license: { name: "ISC", identifier: "ISC" } },
      jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
      servers: [{ url: "https://api.example.com", variables: { region: { default: "eu" } } }],
      tags: [{ name: "users", description: "User management" }],
      externalDocs: { url: "https://example.com" },
      security: [{ bearer: [] }],
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        oauth2: {
          type: "oauth2",
          flows: { clientCredentials: { tokenUrl: "https://example.com/token", scopes: { "read:all": "Read" } } },
        },
      },
      webhooks: { "user.created": { post: { responses: { "200": { description: "Received" } } } } },
      components: { parameters: { Page: { name: "page", in: "query", schema: { type: "integer" } } } },
      extensions: { "x-audience": "internal" },
    });

    const doc = await generate(documented(new RhythmRouter()), full);

    expect(doc.jsonSchemaDialect).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(doc.servers?.[0]?.variables?.region?.default).toBe("eu");
    expect(doc.tags).toEqual([{ name: "users", description: "User management" }]);
    expect(doc.security).toEqual([{ bearer: [] }]);
    expect(doc.webhooks?.["user.created"]?.post?.responses?.["200"]).toEqual({ description: "Received" });
    expect(doc.components?.parameters?.Page).toMatchObject({ name: "page", in: "query" });
    expect(doc.components?.securitySchemes?.oauth2).toMatchObject({ type: "oauth2" });
    expect(doc["x-audience"]).toBe("internal");
  });
});
