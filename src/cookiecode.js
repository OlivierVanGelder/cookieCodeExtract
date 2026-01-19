import { toAbsoluteUrl, uniqPush } from "./utils.js";

export async function login({ page, baseUrl, email, password }) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });

  await page.fill('input[name="emailaddress"]', email);
  await page.fill('input[name="password"]', password);

  await page.click('button[type="submit"], input[type="submit"]');

  await page.waitForLoadState("networkidle");
}

export async function collectEditUrls({ page, baseUrl, pageMax }) {
  const customerEditUrls = new Set();
  const websiteEditUrls = new Set();

  for (let p = 1; p <= pageMax; p++) {
    const listUrl = `${baseUrl}/company/customers?search=&page=${p}`;
    await page.goto(listUrl, { waitUntil: "domcontentloaded" });

    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);

    if (p === 1) {
      await page.screenshot({ path: "debug-customers-page1.png", fullPage: true }).catch(() => {});
    }

    const customerHrefs = await page.$$eval(
      'a[href^="/company/customer-edit/"]',
      (links) => links.map((a) => a.getAttribute("href")).filter(Boolean)
    );

    const websiteHrefs = await page.$$eval(
      'a[href^="/company/website-edit/"]',
      (links) => links.map((a) => a.getAttribute("href")).filter(Boolean)
    );

    console.log(`Pagina ${p}: customer links ${customerHrefs.length}, website links ${websiteHrefs.length}`);

    uniqPush(customerEditUrls, customerHrefs.map((h) => toAbsoluteUrl(baseUrl, h)));
    uniqPush(websiteEditUrls, websiteHrefs.map((h) => toAbsoluteUrl(baseUrl, h)));
  }

  const customers = Array.from(customerEditUrls);
  const websites = Array.from(websiteEditUrls);

  return {
    customerEditUrls: customers,
    websiteEditUrls: websites
  };
}

async function readInputValue(page, selector) {
  const loc = page.locator(selector);
  const count = await loc.count().catch(() => 0);
  if (!count) return "";
  return await loc.first().inputValue().catch(() => "");
}

async function readText(page, selector) {
  const loc = page.locator(selector);
  const count = await loc.count().catch(() => 0);
  if (!count) return "";
  const txt = await loc.first().textContent().catch(() => "");
  return (txt || "").trim();
}

export async function scrapeCustomerEdit({ page, url }) {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await page.waitForSelector('input[name="name"]', { timeout: 20000 });

  const name = await readInputValue(page, 'input[name="name"]');
  const street = await readInputValue(page, 'input[name="street"]');
  const postalcode = await readInputValue(page, 'input[name="postalcode"]');
  const email = await readInputValue(page, 'input[name="email"]');
  const coc = await readInputValue(page, 'input[name="coc"]');

  const country = await readText(page, '.select2-selection__rendered[id^="select2-countryId"]');

  return {
    type: "customer",
    sourceUrl: url,
    finalUrl: page.url(),
    name,
    street,
    postalcode,
    country,
    email,
    coc
  };
}

export async function scrapeWebsiteEdit({ page, url }) {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await page.waitForSelector('input[name="baseurl"]', { timeout: 20000 });

  const baseurl = await readInputValue(page, 'input[name="baseurl"]');
  const contactname = await readInputValue(page, 'input[name="contactname"]');
  const contactemail = await readInputValue(page, 'input[name="contactemail"]');

  return {
    type: "website",
    sourceUrl: url,
    finalUrl: page.url(),
    baseurl,
    contactname,
    contactemail
  };
}
