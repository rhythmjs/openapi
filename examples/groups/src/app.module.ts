import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { scalarModule } from "@rhythmjs/scalar";
import { swaggerModule } from "@rhythmjs/swagger";
import { apiModule } from "./api.module";
import { platformModule } from "./platform.module";

const sources = [
  { url: "/api/v1/openapi.json", title: "Public API" },
  { url: "/api/platform/openapi.json", title: "Platform API" },
];

export const appModule = new Rhythm<RhythmHttpContext>({ name: "app", type: "module" })
  .register(apiModule)
  .register(platformModule)
  .register(scalarModule.forRoot({ path: "/docs", sources, title: "API Reference" }))
  .register(swaggerModule.forRoot({ path: "/swagger", sources, title: "API Reference" }))
  .use((ctx) => {
    ctx.response.status = 404;
    ctx.response.headers.set("content-type", "application/json");
    ctx.response.body = JSON.stringify({ success: false, status: 404, message: "Not Found" });
  });
