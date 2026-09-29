import { describe, expect, test } from "vite-plus/test";
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/adapters/web-std";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { apiResponse } from "../response/response";
import { defineDocument } from "../document/document";
import { apiDocument, apiReference } from "./docs";

const config = defineDocument({ info: { title: "Docs API", version: "1.0.0" } });

const app = () => {
  const router = new RhythmRouter().get("/hello", apiResponse(200, { description: "Greets" }), (ctx) => {
    ctx.json({ hello: "world" });
  });
  return toFetchHandler(
    new Rhythm<RhythmHttpContext>().use(apiDocument({ router, config })).use(apiReference()).use(router.middleware()),
  );
};

describe("apiDocument", () => {
  test("serves the generated document as JSON on its path", async () => {
    const res = await app()(new Request("http://localhost/openapi.json"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe("3.1.1");
    expect(Object.keys(doc.paths)).toEqual(["/hello"]);
  });

  test("passes other requests through to the app", async () => {
    const res = await app()(new Request("http://localhost/hello"));

    expect(await res.json()).toEqual({ hello: "world" });
  });

  test("only responds to GET", async () => {
    const res = await app()(new Request("http://localhost/openapi.json", { method: "POST" }));

    expect(await res.text()).not.toContain('"openapi"');
  });
});

describe("apiReference", () => {
  test("serves a Scalar page by default, pointing at the spec URL", async () => {
    const res = await app()(new Request("http://localhost/docs"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("@scalar/api-reference");
    expect(html).toContain('data-url="/openapi.json"');
  });

  test("serves Swagger UI when asked", async () => {
    const handler = toFetchHandler(
      new Rhythm<RhythmHttpContext>().use(apiReference({ ui: "swagger", title: "Petstore <docs>" })),
    );

    const res = await handler(new Request("http://localhost/docs"));
    const html = await res.text();

    expect(html).toContain("swagger-ui-bundle.js");
    expect(html).toContain("Petstore &lt;docs&gt;");
  });
});
