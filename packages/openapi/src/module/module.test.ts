import { describe, expect, test } from "bun:test";
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import { apiBody } from "../body/body";
import { apiResponse } from "../response/response";
import { apiTags } from "../tags/tags";
import { defineDocument } from "../document/document";
import { documented } from "../generate/generate";
import { openapiModule } from "./module";

const document = defineDocument({ info: { title: "Module API", version: "1.0.0" } });

const hello = documented(new RhythmRouter()).get("/hello", apiResponse(200, { description: "Greets" }), (ctx) => {
  ctx.json({ hello: "world" });
});

const users = documented(new RhythmRouter())
  .use(apiTags("users"))
  .get("/users", apiResponse(200, { description: "Lists users" }), (ctx) => {
    ctx.json([]);
  });

const build = (...routers: RhythmRouter[]) => {
  let app = new Rhythm().use(mount(openapiModule.forRoot({ document })));
  for (const router of routers) app = app.use(mount(router));
  return toFetchHandler(app);
};

const get = (handler: (request: Request) => Promise<Response>, path: string) =>
  handler(new Request(`http://localhost${path}`));

describe("openapiModule", () => {
  test("serves a document built from the routers mounted anywhere in the app", async () => {
    const res = await get(build(hello, users), "/openapi.json");

    const doc = (await res.json()) as { info: { title: string }; paths: Record<string, Record<string, any>> };
    expect(doc.info.title).toBe("Module API");
    expect(Object.keys(doc.paths).sort()).toEqual(["/hello", "/users"]);
    expect(doc.paths["/users"]!.get.tags).toEqual(["users"]);
  });

  test("keeps each router's own middleware scoped to that router", async () => {
    const doc = (await (await get(build(users, hello), "/openapi.json")).json()) as {
      paths: Record<string, Record<string, any>>;
    };

    expect(doc.paths["/hello"]!.get.tags).toBeUndefined();
  });

  test("documents only the app it is registered in, so sibling groups get separate documents", async () => {
    const group = (prefix: string, router: RhythmRouter) =>
      new Rhythm({ name: prefix })
        .use(mount(openapiModule.forRoot({ document, path: `${prefix}/openapi.json` })))
        .use(mount(router));
    const handler = toFetchHandler(
      new Rhythm().use(mount(group("/hello-group", hello))).use(mount(group("/users", users))),
    );

    const paths = async (url: string) =>
      Object.keys(((await (await get(handler, url)).json()) as { paths: object }).paths);

    expect(await paths("/hello-group/openapi.json")).toEqual(["/hello"]);
    expect(await paths("/users/openapi.json")).toEqual(["/users"]);
  });

  test("fails with a clear error when the module was never added to an app", async () => {
    const failure = await toFetchHandler(openapiModule.forRoot({ document }))(
      new Request("http://localhost/openapi.json"),
    ).catch((error: Error) => error);

    expect(((failure as Error).cause ?? failure) as Error).toMatchObject({
      message: expect.stringContaining("documents the app it is registered in"),
    });
  });

  test("finds routers inside nested registered modules", async () => {
    const feature = new Rhythm({ name: "feature" }).use(mount(users));
    const app = new Rhythm()
      .use(mount(openapiModule.forRoot({ document })))
      .use(mount(feature))
      .use(mount(hello));

    const doc = (await (await get(toFetchHandler(app), "/openapi.json")).json()) as { paths: Record<string, unknown> };

    expect(Object.keys(doc.paths).sort()).toEqual(["/hello", "/users"]);
  });

  test("answers only GET on its path; everything else falls through to the app", async () => {
    const handler = build(hello);

    expect(await (await get(handler, "/hello")).json()).toEqual({ hello: "world" });
    expect(await (await handler(new Request("http://localhost/openapi.json", { method: "POST" }))).text()).toBe(
      "Not Found",
    );
    expect(await (await get(handler, "/openapi.json/extra")).text()).toBe("Not Found");
    expect(await (await get(handler, "/docs")).text()).toBe("Not Found");
  });

  test("path moves the document", async () => {
    const handler = toFetchHandler(
      new Rhythm().use(mount(openapiModule.forRoot({ document, path: "/api/openapi.json" }))).use(mount(hello)),
    );

    const doc = (await (await get(handler, "/api/openapi.json")).json()) as { paths: object };

    expect(Object.keys(doc.paths)).toEqual(["/hello"]);
    expect(await (await get(handler, "/openapi.json")).text()).toBe("Not Found");
  });

  test("rejects a path without a leading slash", () => {
    expect(() => openapiModule.forRoot({ document, path: "openapi.json" })).toThrow('must start with "/"');
  });

  test("exposes openapiService on the module", async () => {
    let seen: unknown;
    const docs = openapiModule.forRoot({ document });
    const app = new Rhythm()
      .use(mount(docs))
      .use(mount(hello))
      .use(async () => {
        seen = await docs.openapiService.document();
      });

    await toFetchHandler(app)(new Request("http://localhost/nope"));

    expect(Object.keys((seen as { paths: object }).paths)).toEqual(["/hello"]);
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
    const router = documented(new RhythmRouter()).post("/flaky", apiBody(flaky), (ctx) => {
      ctx.json({ ok: true });
    });
    const handler = build(router);

    const failure = await get(handler, "/openapi.json").catch((error: Error) => error);
    expect((failure as Error).cause).toMatchObject({ message: "boom" });
    const doc = (await (await get(handler, "/openapi.json")).json()) as { paths: Record<string, unknown> };

    expect(doc.paths).toHaveProperty("/flaky");
  });
});
