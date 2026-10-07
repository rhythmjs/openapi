import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/context";
import { docOnly, type OperationFields } from "../metadata/metadata";

export type ApiOperationOptions = OperationFields;

export function apiOperation(options: ApiOperationOptions): Middleware<RhythmHttpContext> {
  return docOnly({ operation: options });
}
