import { describe, expect, test } from "bun:test";
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import { swaggerModule, type SwaggerOptions } from "./swagger";

const app = (options?: SwaggerOptions) =>
  toFetchHandler(
    new Rhythm().use(mount(swaggerModule.forRoot(options))).use((ctx) => {
      // a mounted module hands over to the rest of the app after it runs, so only answer if it did not
      if (ctx.response.body === null) ctx.json({ fellThrough: true });
    }),
  );

const get = (handler: ReturnType<typeof app>, path: string, method = "GET") =>
  handler(new Request(`http://localhost${path}`, { method }));

describe("swaggerModule", () => {
  test("serves Swagger UI at /docs, loading /openapi.json", async () => {
    const res = await get(app(), "/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toContain("swagger-ui-bundle.js");
    expect(html).toContain('url: "/openapi.json"');
  });

  test("path and url move the page and the spec it loads", async () => {
    const handler = app({ path: "/api/swagger", url: "/api/openapi.json" });

    expect(await (await get(handler, "/api/swagger")).text()).toContain('url: "/api/openapi.json"');
    expect(await (await get(handler, "/docs")).json()).toEqual({ fellThrough: true });
  });

  describe("sources", () => {
    const sources = [
      { url: "/api/v1/openapi.json", title: "v1" },
      { url: "/api/platform/openapi.json", title: "Platform" },
      { url: "/api/other.json" },
    ];

    test("lists several documents through the Topbar: urls, the standalone preset and layout", async () => {
      const html = await (await get(app({ sources }), "/docs")).text();

      expect(html).toContain(
        'urls: [{"url":"/api/v1/openapi.json","name":"v1"},{"url":"/api/platform/openapi.json","name":"Platform"},{"url":"/api/other.json","name":"/api/other.json"}]',
      );
      expect(html).toContain(
        'presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset], layout: "StandaloneLayout"',
      );
      expect(html).toContain("swagger-ui-standalone-preset.js");
      expect(html).not.toContain("url: ");
    });

    test("pins the standalone preset like the other assets, and drops its hash with a custom cdn", async () => {
      const pinned = await (await get(app({ sources }), "/docs")).text();
      const tags = pinned.match(/<(?:script|link)\b[^>]*https:\/\/[^>]*>/g) ?? [];
      expect(tags).toHaveLength(3);
      for (const tag of tags) {
        expect(tag).toMatch(/@\d+\.\d+\.\d+\//);
        expect(tag).toMatch(/integrity="sha384-[A-Za-z0-9+/]+=*"/);
      }

      const custom = await (await get(app({ sources, cdn: "/assets/swagger", nonce: "abc" }), "/docs")).text();
      expect(custom).toContain('src="/assets/swagger/swagger-ui-standalone-preset.js"');
      expect(custom).not.toContain("integrity=");
      expect(custom.match(/<script src=[^>]*nonce="abc"/g)).toHaveLength(2);
    });

    test("the single-document page does not load the standalone preset", async () => {
      expect(await (await get(app(), "/docs")).text()).not.toContain("standalone-preset");
    });

    test("rejects url together with sources", () => {
      expect(() => swaggerModule.forRoot({ url: "/a.json", sources })).toThrow("not both");
    });
  });

  test("answers only its own path, and only GET", async () => {
    const handler = app();

    expect(await (await get(handler, "/docs/extra")).json()).toEqual({ fellThrough: true });
    expect(await (await get(handler, "/docs", "POST")).json()).toEqual({ fellThrough: true });
  });

  test("merges swaggerOptions into SwaggerUIBundle, keeping url and dom_id under its control", async () => {
    const html = await (
      await get(app({ swaggerOptions: { docExpansion: "none", persistAuthorization: true } }), "/docs")
    ).text();

    expect(html).toContain('...{"docExpansion":"none","persistAuthorization":true}, url: "/openapi.json"');
    expect(html).toContain('dom_id: "#swagger-ui"');
  });

  test("escapes the title, and the spec URL for the JS string", async () => {
    const html = await (await get(app({ pageTitle: "Petstore <docs>", url: '/x\\"</script><b>' }), "/docs")).text();

    expect(html).toContain("<title>Petstore &lt;docs&gt;</title>");
    expect(html).not.toContain("</script><b>");
    expect(html).toContain('url: "/x\\\\\\"\\u003c/script>\\u003cb>"');
  });

  test("pins CDN assets to an exact version with integrity hashes", async () => {
    const html = await (await get(app(), "/docs")).text();

    const tags = html.match(/<(?:script|link)\b[^>]*https:\/\/[^>]*>/g) ?? [];
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(tag).toMatch(/@\d+\.\d+\.\d+\//);
      expect(tag).toMatch(/integrity="sha384-[A-Za-z0-9+/]+=*"/);
      expect(tag).toContain('crossorigin="anonymous"');
    }
  });

  test("a custom cdn drops the integrity hashes, and nonce is applied", async () => {
    const html = await (await get(app({ cdn: "/assets/swagger/", nonce: "abc" }), "/docs")).text();

    expect(html).toContain('href="/assets/swagger/swagger-ui.css"');
    expect(html).toContain('src="/assets/swagger/swagger-ui-bundle.js"');
    expect(html).not.toContain("integrity=");
    expect(html).toContain('nonce="abc"');
  });

  test("rejects a cdn that is neither http(s) nor root-relative", () => {
    expect(() => swaggerModule.forRoot({ cdn: "javascript:alert(1)" })).toThrow(TypeError);
  });

  test("rejects a path without a leading slash", () => {
    expect(() => swaggerModule.forRoot({ path: "docs" })).toThrow('must start with "/"');
  });
});
