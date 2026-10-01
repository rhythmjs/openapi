import { describe, expect, test } from "bun:test";
import { Rhythm } from "@rhythmjs/rhythm";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { scalarModule, type ScalarOptions } from "./scalar";

const app = (options?: ScalarOptions) =>
  toFetchHandler(
    new Rhythm<RhythmHttpContext>()
      .register(scalarModule.forRoot(options))
      .use((ctx) => ctx.json({ fellThrough: true })),
  );

const get = (handler: ReturnType<typeof app>, path: string, method = "GET") =>
  handler(new Request(`http://localhost${path}`, { method }));

describe("scalarModule", () => {
  test("serves the Scalar page at /docs, pointing at /openapi.json", async () => {
    const res = await get(app(), "/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toContain("@scalar/api-reference");
    expect(html).toContain('data-url="/openapi.json"');
  });

  test("path and url move the page and the spec it loads", async () => {
    const handler = app({ path: "/api/reference", url: "/api/openapi.json" });

    expect(await (await get(handler, "/api/reference")).text()).toContain('data-url="/api/openapi.json"');
    expect(await (await get(handler, "/docs")).json()).toEqual({ fellThrough: true });
  });

  test("sources lists several documents in one page, without a single data-url", async () => {
    const html = await (
      await get(
        app({
          sources: [
            { url: "/api/v1/openapi.json", title: "v1" },
            { url: "/api/platform/openapi.json", title: "Platform" },
          ],
        }),
        "/docs",
      )
    ).text();

    expect(html).not.toContain("data-url");
    expect(html).toContain("&quot;sources&quot;:[");
    expect(html).toContain("&quot;url&quot;:&quot;/api/v1/openapi.json&quot;,&quot;title&quot;:&quot;v1&quot;");
    expect(html).toContain("&quot;title&quot;:&quot;Platform&quot;");
  });

  test("rejects url together with sources", () => {
    expect(() => scalarModule.forRoot({ url: "/a.json", sources: [{ url: "/b.json" }] })).toThrow("not both");
  });

  test("answers only its own path, and only GET", async () => {
    const handler = app();

    expect(await (await get(handler, "/docs/extra")).json()).toEqual({ fellThrough: true });
    expect(await (await get(handler, "/docs", "POST")).json()).toEqual({ fellThrough: true });
  });

  test("passes Scalar's own configuration through, escaped into the attribute", async () => {
    const html = await (await get(app({ theme: "purple", hideModels: true }), "/docs")).text();

    expect(html).toContain("&quot;theme&quot;:&quot;purple&quot;");
    expect(html).toContain("&quot;hideModels&quot;:true");
    expect(html).not.toContain("&quot;path&quot;");
  });

  test("escapes the title and the spec URL", async () => {
    const html = await (await get(app({ title: "Pets <docs>", url: '/x"><b>' }), "/docs")).text();

    expect(html).toContain("<title>Pets &lt;docs&gt;</title>");
    expect(html).not.toContain("<b>");
  });

  test("pins the CDN asset to an exact version with an integrity hash", async () => {
    const html = await (await get(app(), "/docs")).text();

    const tags = html.match(/<script\b[^>]*https:\/\/[^>]*>/g) ?? [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatch(/@\d+\.\d+\.\d+\//);
    expect(tags[0]).toMatch(/integrity="sha384-[A-Za-z0-9+/]+=*"/);
    expect(tags[0]).toContain('crossorigin="anonymous"');
  });

  test("a custom cdn drops the integrity hash, and nonce is applied", async () => {
    const html = await (await get(app({ cdn: "/assets/scalar/", nonce: "abc" }), "/docs")).text();

    expect(html).toContain('src="/assets/scalar/dist/browser/standalone.js"');
    expect(html).not.toContain("integrity=");
    expect(html).toContain('nonce="abc"');
  });

  test("rejects a cdn that is neither http(s) nor root-relative", () => {
    expect(() => scalarModule.forRoot({ cdn: "javascript:alert(1)" })).toThrow(TypeError);
  });

  test("rejects a path without a leading slash", () => {
    expect(() => scalarModule.forRoot({ path: "docs" })).toThrow('must start with "/"');
  });
});
