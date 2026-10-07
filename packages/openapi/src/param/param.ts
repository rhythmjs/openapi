import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ExtensionMiddleware } from "@rhythmjs/rhythm/types";
import type { ParameterOverride } from "../metadata/metadata";
import { schemaMiddleware, type Validated, type ValidationContext } from "../internal/runtime";

export interface ApiParamOptions {
  overrides?: Record<string, ParameterOverride>;
}

export function apiParam<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  options: ApiParamOptions = {},
): ExtensionMiddleware<ValidationContext, Validated<"param", TSchema>> {
  return schemaMiddleware(
    "param",
    schema,
    { parameters: [{ in: "path", schema, ...(options.overrides ? { overrides: options.overrides } : {}) }] },
    (ctx) => ({ ok: true, value: ctx.params ?? {} }),
  );
}
