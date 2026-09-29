import { describe, expect, test } from "vite-plus/test";
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/adapters/web-std";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { z } from "zod";
import { fragmentOf } from "../metadata/metadata";
import { apiBody, type ValidationFailure } from "./body";

const serve = (router: RhythmRouter) => toFetchHandler(new Rhythm<RhythmHttpContext>().use(router.middleware()));

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("apiBody", () => {
  const createUser = z.object({ name: z.string().min(1), age: z.coerce.number().int() });

  const app = () =>
    serve(
      new RhythmRouter().post("/users", apiBody(createUser), (ctx) => {
        ctx.json(ctx.valid.body);
      }),
    );

  test("passes a valid body through and exposes the schema output on ctx.valid.body", async () => {
    const res = await app()(jsonRequest("http://localhost/users", { name: "Ada", age: "36" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: "Ada", age: 36 });
  });

  test("rejects an invalid body with 400 and a ValidationFailure, without running the handler", async () => {
    const res = await app()(jsonRequest("http://localhost/users", { name: "", age: "nope" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as ValidationFailure;
    expect(body.success).toBe(false);
    expect(body.target).toBe("body");
    expect(body.issues.map((issue) => issue.path)).toEqual([["name"], ["age"]]);
  });

  test("rejects malformed JSON with 400", async () => {
    const res = await app()(new Request("http://localhost/users", { method: "POST", body: "{not json" }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as ValidationFailure;
    expect(body.issues).toEqual([{ message: "Malformed JSON in request body" }]);
  });

  test("extracts urlencoded forms when the declared content type is a form", async () => {
    const router = new RhythmRouter().post(
      "/login",
      apiBody(z.object({ user: z.string() }), { contentType: "application/x-www-form-urlencoded" }),
      (ctx) => {
        ctx.json(ctx.valid.body);
      },
    );

    const res = await serve(router)(
      new Request("http://localhost/login", {
        method: "POST",
        body: new URLSearchParams({ user: "ada" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: "ada" });
  });

  test("extracts multipart forms, using the filename for file parts", async () => {
    const router = new RhythmRouter().post(
      "/upload",
      apiBody(z.object({ user: z.string(), avatar: z.string() }), { contentType: "multipart/form-data" }),
      (ctx) => {
        ctx.json(ctx.valid.body);
      },
    );

    const form = new FormData();
    form.append("user", "ada");
    form.append("avatar", new File(["binary"], "avatar.png", { type: "image/png" }));

    const res = await serve(router)(new Request("http://localhost/upload", { method: "POST", body: form }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: "ada", avatar: "avatar.png" });
  });

  test("rejects a multipart body without a boundary with 400", async () => {
    const router = new RhythmRouter().post(
      "/upload",
      apiBody(z.object({ user: z.string() }), { contentType: "multipart/form-data" }),
      (ctx) => {
        ctx.json(ctx.valid.body);
      },
    );

    const res = await serve(router)(
      new Request("http://localhost/upload", {
        method: "POST",
        body: "not multipart",
        headers: { "content-type": "multipart/form-data" },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ValidationFailure;
    expect(body.issues).toEqual([{ message: "Malformed form data in request body" }]);
  });

  test("carries a requestBody fragment with the declared media type", () => {
    const middleware = apiBody(createUser, { description: "New user", contentType: "application/json" });

    const fragment = fragmentOf(middleware);
    expect(fragment?.requestBody?.description).toBe("New user");
    expect(fragment?.requestBody?.required).toBe(true);
    expect(fragment?.requestBody?.content["application/json"]?.schema).toBe(createUser);
  });

  test("a full content map overrides the shorthand", () => {
    const middleware = apiBody(createUser, {
      content: { "application/xml": { schema: { type: "object" } } },
    });

    expect(Object.keys(fragmentOf(middleware)?.requestBody?.content ?? {})).toEqual(["application/xml"]);
  });
});
