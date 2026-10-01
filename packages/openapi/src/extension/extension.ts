import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { docOnly } from "../metadata/metadata";

export function apiExtension(name: `x-${string}`, value: unknown): Middleware<RhythmHttpContext> {
  if (!name.startsWith("x-")) {
    throw new TypeError(`OpenAPI extension names must start with "x-", got "${String(name)}"`);
  }
  return docOnly({ extensions: { [name]: value } });
}
