import { describe, expect, test } from "bun:test";
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmRouter } from "@rhythmjs/router";
import { toFetchHandler } from "@rhythmjs/router/fetch";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { z } from "zod";
import { fragmentOf } from "../metadata/metadata";
import { apiParam } from "./param";

const serve = (router: RhythmRouter) => toFetchHandler(new Rhythm<RhythmHttpContext>().use(router.middleware()));

describe("apiParam", () => {
  const userParams = z.object({ id: z.coerce.number().int() });

  const app = () =>
    serve(
      new RhythmRouter().get("/users/:id", apiParam(userParams), (ctx) => {
        ctx.json(ctx.valid.param);
      }),
    );

  test("validates named route params and exposes the output on ctx.valid.param", async () => {
    const res = await app()(new Request("http://localhost/users/42"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 42 });
  });

  test("rejects a param that fails the schema with 400", async () => {
    const res = await app()(new Request("http://localhost/users/not-a-number"));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { target: string };
    expect(body.target).toBe("param");
  });

  test("carries a path parameter-group fragment", () => {
    expect(fragmentOf(apiParam(userParams))?.parameters).toEqual([{ in: "path", schema: userParams }]);
  });
});
