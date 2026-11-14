import { buildApp } from "./app.js";
import { createDevFakes } from "./bot/fakeBot.js";

// `--fake`（或 BOT_MODE=fake）：不接手機、不跑真 bot，用假的跑完整流程，開發用。
const fake = process.argv.includes("--fake") || process.env.BOT_MODE === "fake";
const fakes = fake ? createDevFakes() : null;
const app = buildApp(
  fakes ? { bot: fakes.bot, device: fakes.device, waitMs: Number(process.env.TELEPORT_WAIT_MS ?? 300) } : {},
);
const port = Number(process.env.PORT ?? 3001);
// 只綁本機，不做登入。
await app.listen({ host: "127.0.0.1", port });
console.error(`server 監聽 http://127.0.0.1:${port}${fake ? "（假 bot、假手機）" : ""}`);
