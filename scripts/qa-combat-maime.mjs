#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("/tmp/qa", { recursive: true });
const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on("console", (msg) => {
  const t = `[${msg.type()}] ${msg.text()}`;
  if (/CharacterPipeline|FighterMesh|Mixamo|plugin|MAIME|BANNON/i.test(t)) logs.push(t);
});
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.getByText("PRESS START").click();
await page.getByText("VERSUS", { exact: true }).click();
await page.waitForTimeout(1500);

const bannon = page.getByText("BANNON", { exact: true }).first();
const maime = page.getByText("MAIME", { exact: true }).first();
await bannon.click();
await page.waitForTimeout(400);
await maime.click();
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/qa/select-bannon-maime.png" });

await page.getByText("FIGHT!").click();
await page.waitForTimeout(800);
const training = page.getByText("TRAINING GRID");
if (await training.count()) await training.click();
await page.getByText("CONFIRM STAGE").click();
await page.waitForTimeout(9000);
await page.screenshot({ path: "/tmp/qa/combat-bannon-maime.png" });

console.log("--- pipeline logs ---");
for (const l of logs.slice(-80)) console.log(l);
await browser.close();
