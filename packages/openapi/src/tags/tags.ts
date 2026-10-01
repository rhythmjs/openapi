import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { docOnly } from "../metadata/metadata";

export function apiTags(...tags: string[]): Middleware<RhythmHttpContext> {
  return docOnly({ tags });
}
