import { toFetchHandler } from "@rhythmjs/router/fetch";
import { appModule } from "./app.module";

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({ port, fetch: toFetchHandler(appModule) });
console.log(`listening on ${server.url}`);
