import "dotenv/config";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { envBool, envInt } from "./utils.js";
import { postBatch } from "./webhook.js";
import { login, collectEditUrls, scrapeCustomerEdit, scrapeWebsiteEdit } from "./cookiecode.js";

async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function readUrlsFile(path) {
  const raw = await fs.readFile(path, "utf8");
  return JSON.parse(raw);
}

async function writeUrlsFile(path, data) {
  await fs.mkdir(path.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await fs.writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  const baseUrl = process.env.COOKIECODE_BASE_URL || "https://portal.cookiecode.nl";
  const email = process.env.COOKIECODE_EMAIL || "";
  const password = process.env.COOKIECODE_PASSWORD || "";

  const pageMax = envInt(process.env.PAGE_MAX, 9);

  const webhookUrl = process.env.WEBHOOK_URL || "";
  const authHeader = process.env.WEBHOOK_AUTH_HEADER || "";
  const authValue = process.env.WEBHOOK_AUTH_VALUE || "";

  const headless = envBool(process.env.HEADLESS, true);
  const slowMoMs = envInt(process.env.SLOW_MO_MS, 0);

  const urlsFile = process.env.URLS_FILE || "data/urls.json";
  const refreshUrls = envBool(process.env.REFRESH_URLS, false);

  if (!email || !password) throw new Error("COOKIECODE_EMAIL of COOKIECODE_PASSWORD ontbreekt");
  if (!webhookUrl) throw new Error("WEBHOOK_URL ontbreekt");

  const browser = await chromium.launch({ headless, slowMo: slowMoMs });
  const context = await browser.newContext();
  const page = await context.newPage();

  let customerEditUrls = [];
  let websiteEditUrls = [];

  try {
    await login({ page, baseUrl, email, password });

    const hasUrlsFile = await fileExists(urlsFile);

    if (!refreshUrls && hasUrlsFile) {
      console.log(`Gebruik opgeslagen urls uit ${urlsFile}`);
      const cached = await readUrlsFile(urlsFile);
      customerEditUrls = Array.isArray(cached.customerEditUrls) ? cached.customerEditUrls : [];
      websiteEditUrls = Array.isArray(cached.websiteEditUrls) ? cached.websiteEditUrls : [];
    } else {
      console.log("Haal urls opnieuw op uit het klantenoverzicht");
      const found = await collectEditUrls({ page, baseUrl, pageMax });
      customerEditUrls = found.customerEditUrls;
      websiteEditUrls = found.websiteEditUrls;

      await writeUrlsFile(urlsFile, {
        savedAt: new Date().toISOString(),
        pageMax,
        customerEditUrls,
        websiteEditUrls
      });

      console.log(`Urls opgeslagen in ${urlsFile}`);
    }

    console.log(`Totaal customer urls: ${customerEditUrls.length}`);
    console.log(`Totaal website urls: ${websiteEditUrls.length}`);

    const records = [];
    const failed = [];

    for (const url of customerEditUrls) {
      try {
        console.log(`Scrape customer: ${url}`);
        const rec = await scrapeCustomerEdit({ page, url });
        records.push(rec);
      } catch (e) {
        const msg = String(e?.message || e);
        console.log(`Fout bij customer: ${url} | ${msg}`);
        failed.push({ type: "customer", url, error: msg });

        await page.screenshot({ path: "debug-fail-customer.png", fullPage: true }).catch(() => {});
        const html = await page.content().catch(() => "");
        await fs.writeFile("debug-fail-customer.html", html, "utf8").catch(() => {});
      }
      await page.waitForTimeout(120);
    }

    for (const url of websiteEditUrls) {
      try {
        console.log(`Scrape website: ${url}`);
        const rec = await scrapeWebsiteEdit({ page, url });
        records.push(rec);
      } catch (e) {
        const msg = String(e?.message || e);
        console.log(`Fout bij website: ${url} | ${msg}`);
        failed.push({ type: "website", url, error: msg });

        const safeId = (url.split("/").pop() || "unknown").replace(/[^a-zA-Z0-9_]/g, "");
        await page.screenshot({ path: `debug-fail-website-${safeId}.png`, fullPage: true }).catch(() => {});
        const html = await page.content().catch(() => "");
        await fs.writeFile(`debug-fail-website-${safeId}.html`, html, "utf8").catch(() => {});
      }
      await page.waitForTimeout(2000);
    }

    const payload = {
      scrapedAt: new Date().toISOString(),
      counts: {
        records: records.length,
        failed: failed.length,
        customersPlanned: customerEditUrls.length,
        websitesPlanned: websiteEditUrls.length
      },
      failed,
      records
    };

    await postBatch({
      webhookUrl,
      authHeader,
      authValue,
      payload
    });

    console.log(`Klaar. Records: ${records.length}. Failed: ${failed.length}.`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
