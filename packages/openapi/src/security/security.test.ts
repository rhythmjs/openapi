import { describe, expect, test } from "bun:test";
import { fragmentOf } from "../metadata/metadata";
import {
  apiBasicAuth,
  apiBearerAuth,
  apiCookieAuth,
  apiKeyAuth,
  apiNoSecurity,
  apiOAuth2,
  apiSecurity,
} from "./security";

describe("security middlewares", () => {
  test("apiSecurity references a named scheme with scopes", () => {
    expect(fragmentOf(apiSecurity("petstore_auth", ["read:pets"]))?.security).toEqual([
      { petstore_auth: ["read:pets"] },
    ]);
  });

  test("presets reference conventional scheme names", () => {
    expect(fragmentOf(apiBearerAuth())?.security).toEqual([{ bearer: [] }]);
    expect(fragmentOf(apiBasicAuth())?.security).toEqual([{ basic: [] }]);
    expect(fragmentOf(apiCookieAuth())?.security).toEqual([{ cookie: [] }]);
    expect(fragmentOf(apiKeyAuth())?.security).toEqual([{ "api-key": [] }]);
    expect(fragmentOf(apiOAuth2(["write:pets"]))?.security).toEqual([{ oauth2: ["write:pets"] }]);
  });

  test("preset names can be overridden", () => {
    expect(fragmentOf(apiBearerAuth("jwt"))?.security).toEqual([{ jwt: [] }]);
  });

  test("apiNoSecurity documents the operation as unsecured", () => {
    expect(fragmentOf(apiNoSecurity())?.security).toBe("none");
  });
});
