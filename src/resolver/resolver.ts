import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { SchemaObject } from "../types/types";
import type { SchemaLike } from "../metadata/metadata";

export type SchemaIO = "input" | "output";

export type SchemaConverter = (schema: StandardSchemaV1, io: SchemaIO) => SchemaObject | Promise<SchemaObject>;

export interface ResolverOptions {
  converters?: Record<string, SchemaConverter>;
}

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return typeof value === "object" && value !== null && "~standard" in value;
}

async function convertZod(schema: StandardSchemaV1, io: SchemaIO): Promise<SchemaObject> {
  const { z } = await import("zod");
  return z.toJSONSchema(schema as never, {
    io,
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as SchemaObject;
}

async function convertValibot(schema: StandardSchemaV1, io: SchemaIO): Promise<SchemaObject> {
  const { toJsonSchema } = await import("@valibot/to-json-schema");
  const options = { errorMode: "ignore", typeMode: io } as never;
  return toJsonSchema(schema as never, options) as SchemaObject;
}

const builtinConverters: Record<string, SchemaConverter> = {
  zod: convertZod,
  valibot: convertValibot,
};

export async function resolveSchema(
  schema: SchemaLike,
  io: SchemaIO,
  options: ResolverOptions = {},
): Promise<SchemaObject> {
  if (!isStandardSchema(schema)) return schema;

  const vendor = schema["~standard"].vendor;
  const convert = options.converters?.[vendor] ?? builtinConverters[vendor];
  if (!convert) {
    throw new Error(`No JSON Schema converter for schema vendor "${vendor}". Pass one via the "converters" option.`);
  }

  const json = await convert(schema, io);
  if (typeof json === "object" && json !== null && "$schema" in json) {
    const { $schema: _dialect, ...rest } = json;
    return rest;
  }
  return json;
}
