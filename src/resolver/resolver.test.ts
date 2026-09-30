import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { isStandardSchema, resolveSchema } from "./resolver";

describe("resolver", () => {
  test("isStandardSchema distinguishes Standard Schemas from raw JSON Schemas", () => {
    expect(isStandardSchema(z.string())).toBe(true);
    expect(isStandardSchema({ type: "string" })).toBe(false);
  });

  test("raw JSON Schemas pass through untouched", () => {
    const raw = { type: "object", properties: { id: { type: "string" } } };

    expect(resolveSchema(raw, "input")).toBe(raw);
  });

  test("converts zod schemas via the Standard JSON Schema interface", () => {
    const schema = z.object({ name: z.string(), age: z.number().int().optional() });

    const json = resolveSchema(schema, "input") as Record<string, unknown>;

    expect(json.type).toBe("object");
    expect((json.properties as Record<string, Record<string, unknown>>).name.type).toBe("string");
    expect(json.required).toEqual(["name"]);
    expect(json).not.toHaveProperty("$schema");
  });

  test("io picks the side of a transforming schema: string in, number out", () => {
    const schema = z.object({ count: z.string().transform(Number).pipe(z.number()) });

    const input = resolveSchema(schema, "input") as { properties: Record<string, Record<string, unknown>> };
    const output = resolveSchema(schema, "output") as { properties: Record<string, Record<string, unknown>> };

    expect(input.properties.count.type).toBe("string");
    expect(output.properties.count.type).toBe("number");
  });

  test("unrepresentable types document as an empty schema instead of throwing", () => {
    const schema = z.object({ when: z.date() });

    const json = resolveSchema(schema, "input") as { properties: Record<string, unknown> };

    expect(json.properties.when).toEqual({});
  });

  test("throws a descriptive error for a vendor without Standard JSON Schema support", () => {
    const fake = {
      "~standard": { version: 1, vendor: "mystery", validate: (value: unknown) => ({ value }) },
    } as never;

    expect(() => resolveSchema(fake, "input")).toThrow('vendor "mystery"');
  });
});
