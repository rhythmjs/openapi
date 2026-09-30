import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import type { SchemaObject } from "../types/types";
import type { SchemaLike } from "../metadata/metadata";

export type SchemaIO = "input" | "output";

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return typeof value === "object" && value !== null && "~standard" in value;
}

export function resolveSchema(schema: SchemaLike, io: SchemaIO): SchemaObject {
  if (!isStandardSchema(schema)) return schema;

  const props = schema["~standard"] as StandardSchemaV1.Props & Partial<StandardJSONSchemaV1.Props>;
  if (!props.jsonSchema) {
    throw new Error(
      `Schema vendor "${props.vendor}" does not implement the Standard JSON Schema interface ` +
        `("~standard".jsonSchema). Use zod ^4.2.0 or pass a raw JSON Schema object instead.`,
    );
  }

  const json = props.jsonSchema[io]({ target: "draft-2020-12", libraryOptions: { unrepresentable: "any" } });
  if ("$schema" in json) {
    const { $schema: _dialect, ...rest } = json;
    return rest;
  }
  return json;
}
