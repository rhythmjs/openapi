import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { CallbackObject, ReferenceObject } from "../types/types";
import { docOnly } from "../metadata/metadata";

export function apiCallback(name: string, callback: CallbackObject | ReferenceObject): Middleware<RhythmHttpContext> {
  return docOnly({ callbacks: { [name]: callback } });
}
