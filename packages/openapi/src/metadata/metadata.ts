import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type {
  CallbackObject,
  EncodingObject,
  ExampleObject,
  LinkObject,
  OperationObject,
  ParameterLocation,
  ParameterStyle,
  ReferenceObject,
  SchemaObject,
  SecurityRequirementObject,
} from "../types/types";

export const OPENAPI_METADATA: symbol = Symbol.for("rhythmjs.openapi");

export type SchemaLike = StandardSchemaV1 | SchemaObject;

export interface MediaTypeSpec {
  schema?: SchemaLike;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  encoding?: Record<string, EncodingObject>;
}

export interface ParameterOverride {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: ParameterStyle;
  explode?: boolean;
  allowReserved?: boolean;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
}

export interface ParameterGroupSpec {
  in: ParameterLocation;
  schema: SchemaLike;
  overrides?: Record<string, ParameterOverride>;
}

export interface RequestBodySpec {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeSpec>;
}

export interface HeaderSpec {
  description?: string;
  required?: boolean;
  schema?: SchemaLike;
}

export interface ResponseSpec {
  description: string;
  content?: Record<string, MediaTypeSpec>;
  headers?: Record<string, HeaderSpec | ReferenceObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
}

export type OperationFields = Pick<
  OperationObject,
  "summary" | "description" | "operationId" | "deprecated" | "externalDocs" | "servers"
>;

export interface OperationFragment {
  operation?: OperationFields;
  tags?: readonly string[];
  parameters?: readonly ParameterGroupSpec[];
  requestBody?: RequestBodySpec;
  responses?: Record<string, ResponseSpec | ReferenceObject>;
  security?: readonly SecurityRequirementObject[] | "none";
  callbacks?: Record<string, CallbackObject | ReferenceObject>;
  extensions?: Record<`x-${string}`, unknown>;
  exclude?: boolean;
}

export function withFragment<TFn>(fn: TFn, fragment: OperationFragment): TFn {
  Object.defineProperty(fn, OPENAPI_METADATA, { value: fragment });
  return fn;
}

export function fragmentOf(fn: unknown): OperationFragment | undefined {
  if (typeof fn !== "function") return undefined;
  return (fn as unknown as Record<symbol, unknown>)[OPENAPI_METADATA] as OperationFragment | undefined;
}

export function docOnly(fragment: OperationFragment): Middleware<RhythmHttpContext> {
  return withFragment(async (_ctx, next) => {
    await next();
  }, fragment);
}
