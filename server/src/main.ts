import { buildApp } from "./app.js";

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);
// 只綁本機，不做登入。
await app.listen({ host: "127.0.0.1", port });
console.error(`server 監聽 http://127.0.0.1:${port}`);
