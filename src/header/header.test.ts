import { describe, expect, test } from "bun:test";
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { z } from "zod";
import { fragmentOf } from "../metadata/metadata";
import { apiHeader } from "./header";

const serve = (router: RhythmRouter) => toFetchHandler(new Rhythm<RhythmHttpContext>().use(router.middleware()));

describe("apiHeader", () => {
  const requestHeaders = z.object({ "x-request-id": z.string().min(1) });

  const app = () =>
    serve(
      new RhythmRouter().get("/ping", apiHeader(requestHeaders), (ctx) => {
        ctx.json(ctx.valid.header);
      }),
    );

  test("validates request headers (lowercased) and exposes the output on ctx.valid.header", async () => {
    const res = await app()(new Request("http://localhost/ping", { headers: { "X-Request-Id": "abc" } }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ "x-request-id": "abc" });
  });

  test("rejects a missing required header with 400", async () => {
    const res = await app()(new Request("http://localhost/ping"));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { target: string };
    expect(body.target).toBe("header");
  });

  test("carries a header parameter-group fragment", () => {
    expect(fragmentOf(apiHeader(requestHeaders))?.parameters).toEqual([{ in: "header", schema: requestHeaders }]);
  });
});
