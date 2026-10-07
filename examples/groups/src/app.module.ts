import { Rhythm, mount } from "@rhythmjs/rhythm";
import { scalarModule } from "@rhythmjs/scalar";
import { swaggerModule } from "@rhythmjs/swagger";
import { apiModule } from "./api.module";
import { platformModule } from "./platform.module";

const sources = [
  { url: "/api/v1/openapi.json", title: "Public API" },
  { url: "/api/platform/openapi.json", title: "Platform API" },
];

export const appModule = new Rhythm({ name: "app" })
  .use(mount(apiModule))
  .use(mount(platformModule))
  .use(mount(scalarModule.forRoot({ path: "/docs", sources, pageTitle: "API Reference" })))
  .use(mount(swaggerModule.forRoot({ path: "/swagger", sources, pageTitle: "API Reference" })))
  .use((ctx) => {
    if (ctx.response.body === null) ctx.json({ success: false, status: 404, message: "Not Found" }, 404);
  });
