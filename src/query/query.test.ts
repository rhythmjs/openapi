import { describe, expect, test } from "bun:test";
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { z } from "zod";
import { fragmentOf } from "../metadata/metadata";
import { apiQuery } from "./query";

const serve = (router: RhythmRouter) => toFetchHandler(new Rhythm<RhythmHttpContext>().use(router.middleware()));

describe("apiQuery", () => {
  const listQuery = z.object({ q: z.string(), limit: z.coerce.number().int().optional() });

  const app = () =>
    serve(
      new RhythmRouter().get("/search", apiQuery(listQuery), (ctx) => {
        ctx.json(ctx.valid.query);
      }),
    );

  test("validates the query string and exposes the output on ctx.valid.query", async () => {
    const res = await app()(new Request("http://localhost/search?q=ada&limit=5"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ q: "ada", limit: 5 });
  });

  test("rejects a missing required parameter with 400", async () => {
    const res = await app()(new Request("http://localhost/search?limit=5"));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { target: string };
    expect(body.target).toBe("query");
  });

  test("collects repeated keys into arrays", async () => {
    const router = new RhythmRouter().get("/tags", apiQuery(z.object({ tag: z.array(z.string()) })), (ctx) => {
      ctx.json(ctx.valid.query);
    });

    const res = await serve(router)(new Request("http://localhost/tags?tag=a&tag=b"));

    expect(await res.json()).toEqual({ tag: ["a", "b"] });
  });

  test("carries a query parameter-group fragment with overrides", () => {
    const middleware = apiQuery(listQuery, { overrides: { q: { description: "Search text" } } });

    const fragment = fragmentOf(middleware);
    expect(fragment?.parameters).toEqual([
      { in: "query", schema: listQuery, overrides: { q: { description: "Search text" } } },
    ]);
  });
});
