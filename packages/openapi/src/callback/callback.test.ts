import { describe, expect, test } from "bun:test";
import { fragmentOf } from "../metadata/metadata";
import { apiCallback } from "./callback";

describe("apiCallback", () => {
  test("carries the callback map as a fragment", () => {
    const callback = {
      "{$request.body#/callbackUrl}": {
        post: { responses: { "200": { description: "Received" } } },
      },
    };

    expect(fragmentOf(apiCallback("onEvent", callback))?.callbacks).toEqual({ onEvent: callback });
  });
});
