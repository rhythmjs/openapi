import { describe, expect, test } from "bun:test";
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { apiBody } from "../body/body";
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
    expect(doc.openapi).toBe("3.1.2");
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

  test("a failed generation is not cached: the next request retries", async () => {
    let calls = 0;
    const flaky = {
      "~standard": {
        version: 1,
        vendor: "zod",
        validate: (value: unknown) => ({ value }),
        jsonSchema: {
          input: (): Record<string, unknown> => {
            calls += 1;
            if (calls === 1) throw new Error("boom");
            return { type: "string" };
          },
          output: (): Record<string, unknown> => ({ type: "string" }),
        },
      },
    } as never;
    const router = new RhythmRouter().post("/flaky", apiBody(flaky), (ctx) => {
      ctx.json({ ok: true });
    });
    const middleware = apiDocument({ router, config });
    let body: unknown;
    const ctx = { request: new Request("http://localhost/openapi.json"), json: (data: unknown) => (body = data) };
    const next = async (): Promise<never> => ctx as never;

    await expect(middleware(ctx as never, next)).rejects.toThrow("boom");
    await middleware(ctx as never, next);

    expect((body as { paths: Record<string, unknown> }).paths).toHaveProperty("/flaky");
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

  test("pins CDN assets to an exact version with integrity hashes", async () => {
    const scalar = await (await app()(new Request("http://localhost/docs"))).text();
    const swagger = await (
      await toFetchHandler(new Rhythm<RhythmHttpContext>().use(apiReference({ ui: "swagger" })))(
        new Request("http://localhost/docs"),
      )
    ).text();

    for (const html of [scalar, swagger]) {
      for (const tag of html.match(/<(?:script|link)\b[^>]*https:\/\/[^>]*>/g) ?? []) {
        expect(tag).toMatch(/@\d+\.\d+\.\d+\//);
        expect(tag).toMatch(/integrity="sha384-[A-Za-z0-9+/]+=*"/);
        expect(tag).toContain('crossorigin="anonymous"');
      }
    }
    expect(scalar).toContain("https://cdn.jsdelivr.net/npm/@scalar/api-reference@");
  });

  test("escapes the spec URL for the JS string in the Swagger page", async () => {
    const handler = toFetchHandler(
      new Rhythm<RhythmHttpContext>().use(apiReference({ ui: "swagger", specUrl: '/x\\"</script><b>' })),
    );

    const html = await (await handler(new Request("http://localhost/docs"))).text();

    expect(html).not.toContain("</script><b>");
    expect(html).toContain('url: "/x\\\\\\"\\u003c/script>\\u003cb>"');
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

describe("apiDocument as YAML", () => {
  const yamlApp = (options: { path?: string; format?: "json" | "yaml" }) => {
    const router = new RhythmRouter().get("/hello", apiResponse(200, { description: "Greets" }), (ctx) => {
      ctx.json({ hello: "world" });
    });
    return toFetchHandler(new Rhythm<RhythmHttpContext>().use(apiDocument({ router, config, ...options })));
  };

  test("format: yaml serves the same document at /openapi.yaml", async () => {
    const res = await yamlApp({ format: "yaml" })(new Request("http://localhost/openapi.yaml"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/yaml");
    const text = await res.text();
    expect(text).toContain("openapi: 3.1.2");
    const json = await (await app()(new Request("http://localhost/openapi.json"))).json();
    expect(Bun.YAML.parse(text)).toEqual(json as never);
  });

  test("a .yml or .yaml path selects YAML without the option", async () => {
    for (const path of ["/openapi.yml", "/spec/api.yaml"]) {
      const res = await yamlApp({ path })(new Request(`http://localhost${path}`));

      expect(res.headers.get("content-type")).toContain("application/yaml");
      expect(Bun.YAML.parse(await res.text())).toHaveProperty("openapi", "3.1.2");
    }
  });

  test("the JSON endpoint and the default paths are unchanged", async () => {
    const res = await yamlApp({})(new Request("http://localhost/openapi.json"));

    expect(res.headers.get("content-type")).toContain("application/json");
    expect(((await res.json()) as { openapi: string }).openapi).toBe("3.1.2");
    expect((await yamlApp({ format: "yaml" })(new Request("http://localhost/openapi.json"))).status).toBe(200);
  });
});

describe("apiReference options", () => {
  const page = async (options: Parameters<typeof apiReference>[0]) =>
    (
      await toFetchHandler(new Rhythm<RhythmHttpContext>().use(apiReference(options)))(
        new Request("http://localhost/docs"),
      )
    ).text();

  test("scalar options are passed to Scalar as its configuration, HTML-escaped", async () => {
    const html = await page({ scalar: { theme: "purple", customCss: 'a[href="x"] { color: red }', hideModels: true } });
    const attr = html.match(/data-configuration="([^"]*)"/)?.[1] ?? "";
    const config = JSON.parse(
      attr.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"),
    );

    expect(config).toEqual({ theme: "purple", customCss: 'a[href="x"] { color: red }', hideModels: true });
    expect(html).toContain('data-url="/openapi.json"');
  });

  test("no scalar options means no configuration attribute", async () => {
    expect(await page({})).not.toContain("data-configuration");
  });

  test("a nonce goes on every script tag, for both UIs", async () => {
    for (const ui of ["scalar", "swagger"] as const) {
      const html = await page({ ui, nonce: 'abc"123' });
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];

      expect(scripts.length).toBeGreaterThanOrEqual(2);
      for (const tag of scripts) expect(tag).toContain('nonce="abc&quot;123"');
    }
  });

  test("cdn pins Scalar to your own version and drops the built-in integrity hash", async () => {
    const html = await page({ cdn: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.67.0/" });

    expect(html).toContain(
      'src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.67.0/dist/browser/standalone.js"',
    );
    expect(html).not.toContain("integrity=");
  });

  test("cdn points Swagger UI at a self-hosted folder", async () => {
    const html = await page({ ui: "swagger", cdn: "/assets/swagger-ui" });

    expect(html).toContain('href="/assets/swagger-ui/swagger-ui.css"');
    expect(html).toContain('src="/assets/swagger-ui/swagger-ui-bundle.js"');
    expect(html).not.toContain("integrity=");
  });

  test("cdn must be an http(s) URL or a root-relative path", () => {
    expect(() => apiReference({ cdn: "javascript:alert(1)" })).toThrow(TypeError);
    expect(() => apiReference({ cdn: "assets/scalar" })).toThrow(TypeError);
  });

  test("swagger options are merged into SwaggerUIBundle, script-safe, and cannot replace the url", async () => {
    const html = await page({
      ui: "swagger",
      swagger: { docExpansion: "none", persistAuthorization: true, filter: "</script><b>", url: "/evil" },
    });

    expect(html).toContain('"docExpansion":"none"');
    expect(html).toContain('"persistAuthorization":true');
    expect(html).not.toContain("</script><b>");
    expect(html).toContain('url: "/openapi.json", dom_id: "#swagger-ui"');
  });
});
