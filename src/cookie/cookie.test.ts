import { describe, expect, test } from "bun:test";
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { z } from "zod";
import { fragmentOf } from "../metadata/metadata";
import { apiCookie } from "./cookie";

const serve = (router: RhythmRouter) => toFetchHandler(new Rhythm<RhythmHttpContext>().use(router.middleware()));

describe("apiCookie", () => {
  const sessionCookies = z.object({ session: z.string().min(1) });

  const app = () =>
    serve(
      new RhythmRouter().get("/me", apiCookie(sessionCookies), (ctx) => {
        ctx.json(ctx.valid.cookie);
      }),
    );

  test("parses the cookie header and exposes the output on ctx.valid.cookie", async () => {
    const res = await app()(new Request("http://localhost/me", { headers: { cookie: "session=abc123; theme=dark" } }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session: "abc123" });
  });

  test("decodes URI-encoded cookie values", async () => {
    const router = new RhythmRouter().get("/echo", apiCookie(z.object({ name: z.string() })), (ctx) => {
      ctx.json(ctx.valid.cookie);
    });

    const res = await serve(router)(
      new Request("http://localhost/echo", { headers: { cookie: "name=Ada%20Lovelace" } }),
    );

    expect(await res.json()).toEqual({ name: "Ada Lovelace" });
  });

  test("rejects a missing required cookie with 400", async () => {
    const res = await app()(new Request("http://localhost/me"));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { target: string };
    expect(body.target).toBe("cookie");
  });

  test("carries a cookie parameter-group fragment", () => {
    expect(fragmentOf(apiCookie(sessionCookies))?.parameters).toEqual([{ in: "cookie", schema: sessionCookies }]);
  });
});
