import "dotenv/config";
import { chromium } from "playwright";
import { chunkArray, envBool, envInt } from "./utils.js";
import { postBatch } from "./webhook.js";
import { login, collectEditUrls, scrapeCustomerEdit, scrapeWebsiteEdit } from "./cookiecode.js";

async function main() {
  const baseUrl = process.env.COOKIECODE_BASE_URL || "https://portal.cookiecode.nl";
  const email = process.env.COOKIECODE_EMAIL || "";
  const password = process.env.COOKIECODE_PASSWORD || "";

  const pageMax = envInt(process.env.PAGE_MAX, 9);
  const batchSize = envInt(process.env.BATCH_SIZE, 50);

  const webhookUrl = process.env.WEBHOOK_URL || "";
  const authHeader = process.env.WEBHOOK_AUTH_HEADER || "";
  const authValue = process.env.WEBHOOK_AUTH_VALUE || "";

  const headless = envBool(process.env.HEADLESS, true);
  const slowMoMs = envInt(process.env.SLOW_MO_MS, 0);

  if (!email || !password) throw new Error("COOKIECODE_EMAIL of COOKIECODE_PASSWORD ontbreekt");
  if (!webhookUrl) throw new Error("WEBHOOK_URL ontbreekt");

  const browser = await chromium.launch({ headless, slowMo: slowMoMs });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login({ page, baseUrl, email, password });

    const { customerEditUrls, websiteEditUrls } = await collectEditUrls({
      page,
      baseUrl,
      pageMax
    });

    const records = [];

    for (const url of customerEditUrls) {
      const rec = await scrapeCustomerEdit({ page, url });
      records.push(rec);
      await page.waitForTimeout(120);
    }

    for (const url of websiteEditUrls) {
      const rec = await scrapeWebsiteEdit({ page, url });
      records.push(rec);
      await page.waitForTimeout(120);
    }

    const batches = chunkArray(records, batchSize);

    for (const batch of batches) {
      const payload = {
        scrapedAt: new Date().toISOString(),
        count: batch.length,
        records: batch
      };

      await postBatch({
        webhookUrl,
        authHeader,
        authValue,
        payload
      });
    }

    console.log(`Klaar. Records: ${records.length}. Batches: ${batches.length}.`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
