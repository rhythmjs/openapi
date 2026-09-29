import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { docOnly } from "../metadata/metadata";

export function apiSecurity(name: string, scopes: string[] = []): Middleware<RhythmHttpContext> {
  return docOnly({ security: [{ [name]: scopes }] });
}

export function apiBearerAuth(name = "bearer"): Middleware<RhythmHttpContext> {
  return apiSecurity(name);
}

export function apiBasicAuth(name = "basic"): Middleware<RhythmHttpContext> {
  return apiSecurity(name);
}

export function apiCookieAuth(name = "cookie"): Middleware<RhythmHttpContext> {
  return apiSecurity(name);
}

export function apiKeyAuth(name = "api-key"): Middleware<RhythmHttpContext> {
  return apiSecurity(name);
}

export function apiOAuth2(scopes: string[], name = "oauth2"): Middleware<RhythmHttpContext> {
  return apiSecurity(name, scopes);
}

export function apiNoSecurity(): Middleware<RhythmHttpContext> {
  return docOnly({ security: "none" });
}
