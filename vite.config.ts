import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      "types/types": "src/types/types.ts",
      "metadata/metadata": "src/metadata/metadata.ts",
      "resolver/resolver": "src/resolver/resolver.ts",
      "body/body": "src/body/body.ts",
      "query/query": "src/query/query.ts",
      "param/param": "src/param/param.ts",
      "header/header": "src/header/header.ts",
      "cookie/cookie": "src/cookie/cookie.ts",
      "operation/operation": "src/operation/operation.ts",
      "response/response": "src/response/response.ts",
      "tags/tags": "src/tags/tags.ts",
      "security/security": "src/security/security.ts",
      "exclude/exclude": "src/exclude/exclude.ts",
      "extension/extension": "src/extension/extension.ts",
      "callback/callback": "src/callback/callback.ts",
      "document/document": "src/document/document.ts",
      "generate/generate": "src/generate/generate.ts",
      "docs/docs": "src/docs/docs.ts",
    },
    format: "esm",
    dts: true,
    fixedExtension: false,
    clean: true,
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/node_modules/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: ["**/dist/**", "**/node_modules/**"],
    printWidth: 120,
    singleQuote: false,
    semi: true,
  },
});
