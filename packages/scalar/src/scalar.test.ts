import { describe, expect, test } from "bun:test";
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import { scalarModule, type ScalarOptions } from "./scalar";

const app = (options?: ScalarOptions) =>
  toFetchHandler(
    new Rhythm().use(mount(scalarModule.forRoot(options))).use((ctx) => {
      // a mounted module hands over to the rest of the app after it runs, so only answer if it did not
      if (ctx.response.body === null) ctx.json({ fellThrough: true });
    }),
  );

const get = (handler: ReturnType<typeof app>, path: string, method = "GET") =>
  handler(new Request(`http://localhost${path}`, { method }));

const page = async (options?: ScalarOptions) => (await get(app(options), "/docs")).text();

describe("scalarModule", () => {
  test("serves the Scalar page at /docs, loading /openapi.json", async () => {
    const res = await get(app(), "/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toContain("https://cdn.jsdelivr.net/npm/@scalar/api-reference");
    expect(html).toContain('"url": "/openapi.json"');
  });

  test("path and url move the page and the spec it loads", async () => {
    const handler = app({ path: "/api/reference", url: "/api/openapi.json" });

    expect(await (await get(handler, "/api/reference")).text()).toContain('"url": "/api/openapi.json"');
    expect(await (await get(handler, "/docs")).json()).toEqual({ fellThrough: true });
  });

  test("answers only its own path, and only GET", async () => {
    const handler = app();

    expect(await (await get(handler, "/docs/extra")).json()).toEqual({ fellThrough: true });
    expect(await (await get(handler, "/docs", "POST")).json()).toEqual({ fellThrough: true });
  });

  test("sources lists several documents, without the default url", async () => {
    const html = await page({
      sources: [
        { url: "/api/v1/openapi.json", title: "v1" },
        { url: "/api/platform/openapi.json", title: "Platform" },
      ],
    });

    expect(html).not.toContain('"url": "/openapi.json"');
    expect(html).toContain('"sources"');
    expect(html).toContain('"url": "/api/v1/openapi.json"');
    expect(html).toContain('"title": "Platform"');
  });

  test("passes Scalar's own configuration through", async () => {
    const html = await page({ theme: "purple", hideModels: true });

    expect(html).toContain('"theme": "purple"');
    expect(html).toContain('"hideModels": true');
    expect(html).not.toContain('"path"');
  });

  test("escapes the page title and keeps a hostile url out of the script", async () => {
    const html = await page({ pageTitle: "Pets <docs>", url: "/x</script><script>alert(1)</script>" });

    expect(html).toContain("<title>Pets &lt;docs&gt;</title>");
    expect(html).not.toContain("</script><script>alert(1)");
  });

  test("a nonce goes on the scripts and the CSP meta tag", async () => {
    const html = await page({ nonce: "abc" });

    expect(html).toContain('<meta property="csp-nonce" content="abc" />');
    expect(html.match(/<script\b[^>]*nonce="abc"/g)).toHaveLength(2);
  });

  test("cdn selects the single-file bundle at that URL, and bundle a specific ESM build", async () => {
    expect(await page({ cdn: "/assets/scalar.js" })).toContain('<script src="/assets/scalar.js"');
    expect(await page({ bundle: "/assets/scalar-esm.js" })).toContain("from '/assets/scalar-esm.js'");
  });

  test("rejects a path without a leading slash", () => {
    expect(() => scalarModule.forRoot({ path: "docs" })).toThrow('must start with "/"');
  });
});
