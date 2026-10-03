import { describe, expect, test } from "bun:test";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import { appModule } from "./app.module";

const handler = toFetchHandler(appModule);
const get = (path: string) => handler(new Request(`http://localhost${path}`));

type Document = {
  info: { title: string };
  paths: Record<string, Record<string, { tags?: string[]; security?: unknown }>>;
};

describe("groups", () => {
  test("each group serves its own document, listing only its own routes", async () => {
    const api = (await (await get("/api/v1/openapi.json")).json()) as Document;
    const platform = (await (await get("/api/platform/openapi.json")).json()) as Document;

    expect(api.info.title).toBe("Public API");
    expect(Object.keys(api.paths)).toEqual(["/api/v1/users", "/api/v1/users/{id}"]);
    expect(platform.info.title).toBe("Platform API");
    expect(Object.keys(platform.paths)).toEqual(["/api/platform/health", "/api/platform/tenants"]);
  });

  test("a router's middleware stays inside its group: tags, and bearer auth on routes after use()", async () => {
    const platform = (await (await get("/api/platform/openapi.json")).json()) as Document;

    expect(platform.paths["/api/platform/health"]!.get!.tags).toEqual(["platform"]);
    expect(platform.paths["/api/platform/health"]!.get!.security).toEqual([]);
    expect(platform.paths["/api/platform/tenants"]!.get!.security).toEqual([{ bearer: [] }]);
  });

  test("the UIs sit at the top level and list both documents", async () => {
    const scalar = await (await get("/docs")).text();
    expect(scalar).toContain('"url": "/api/v1/openapi.json"');
    expect(scalar).toContain('"title": "Public API"');
    expect(scalar).toContain('"url": "/api/platform/openapi.json"');
    expect(scalar).toContain('"title": "Platform API"');

    const swagger = await (await get("/swagger")).text();
    expect(swagger).toContain('{"url":"/api/v1/openapi.json","name":"Public API"}');
    expect(swagger).toContain('{"url":"/api/platform/openapi.json","name":"Platform API"}');
  });

  test("the routes themselves still work, and unknown paths hit the app's 404", async () => {
    expect(await (await get("/api/v1/users/7")).json()).toEqual({ id: "7", name: "Ada" });
    expect(await (await get("/api/platform/health")).json()).toEqual({ status: "ok" });
    expect((await get("/openapi.json")).status).toBe(404);
    expect((await get("/api/v1/docs")).status).toBe(404);
  });
});
