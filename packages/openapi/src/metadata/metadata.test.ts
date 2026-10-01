import { describe, expect, test } from "bun:test";
import { docOnly, fragmentOf, withFragment, type OperationFragment } from "./metadata";

describe("metadata", () => {
  test("withFragment attaches a fragment that fragmentOf reads back", () => {
    const fn = async (): Promise<void> => {};
    const fragment: OperationFragment = { tags: ["users"] };

    expect(fragmentOf(withFragment(fn, fragment))).toBe(fragment);
  });

  test("the fragment survives across module copies via a global symbol registry", () => {
    const fn = withFragment(async (): Promise<void> => {}, { exclude: true });

    expect((fn as unknown as Record<symbol, unknown>)[Symbol.for("rhythmjs.openapi")]).toEqual({ exclude: true });
  });

  test("fragmentOf returns undefined for plain functions and non-functions", () => {
    expect(fragmentOf(() => {})).toBeUndefined();
    expect(fragmentOf(null)).toBeUndefined();
    expect(fragmentOf({ tags: ["x"] })).toBeUndefined();
  });

  test("docOnly produces a passthrough middleware carrying the fragment", async () => {
    const middleware = docOnly({ tags: ["a"] });
    let called = false;

    await middleware(
      {} as never,
      (async () => {
        called = true;
      }) as never,
    );

    expect(called).toBe(true);
    expect(fragmentOf(middleware)).toEqual({ tags: ["a"] });
  });
});
