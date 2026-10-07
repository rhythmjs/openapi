import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/context";
import { docOnly } from "../metadata/metadata";

export function apiExclude(): Middleware<RhythmHttpContext> {
  return docOnly({ exclude: true });
}
