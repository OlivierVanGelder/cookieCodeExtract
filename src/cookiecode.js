import { toAbsoluteUrl, uniqPush } from "./utils.js";

export async function login({ page, baseUrl, email, password }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });

  // Als de portal andere name attributen gebruikt, pas dit aan
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

export async function collectEditUrls({ page, baseUrl, pageMax }) {
  const customerEditUrls = new Set();
  const websiteEditUrls = new Set();

  for (let p = 1; p <= pageMax; p++) {
    const listUrl = `${baseUrl}/company/customers?search=&page=${p}`;
    await page.goto(listUrl, { waitUntil: "domcontentloaded" });

    // Klant edit links
    const customerHrefs = await page.$$eval(
      'a[href^="/company/customer-edit/"]',
      (links) => links.map((a) => a.getAttribute("href")).filter(Boolean)
    );

    // Website edit links
    const websiteHrefs = await page.$$eval(
      'a[href^="/company/website-edit/"]',
      (links) => links.map((a) => a.getAttribute("href")).filter(Boolean)
    );

    uniqPush(customerEditUrls, customerHrefs.map((h) => toAbsoluteUrl(baseUrl, h)));
    uniqPush(websiteEditUrls, websiteHrefs.map((h) => toAbsoluteUrl(baseUrl, h)));
  }

  return {
    customerEditUrls: Array.from(customerEditUrls),
    websiteEditUrls: Array.from(websiteEditUrls)
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
  await page.waitForSelector("form", { timeout: 15000 });

  // Velden volgens jouw HTML
  const name = await readInputValue(page, 'input[name="name"]');
  const street = await readInputValue(page, 'input[name="street"]');
  const postalcode = await readInputValue(page, 'input[name="postalcode"]');
  const email = await readInputValue(page, 'input[name="email"]');
  const coc = await readInputValue(page, 'input[name="coc"]');

  // Land is een select2 rendered span
  // Id kan per record verschillen, daarom selecteren we op id prefix
  const country = await readText(page, '.select2-selection__rendered[id^="select2-countryId"]');

  return {
    type: "customer",
    sourceUrl: url,
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
  await page.waitForSelector("form", { timeout: 15000 });

  const baseurl = await readInputValue(page, 'input[name="baseurl"]');
  const contactname = await readInputValue(page, 'input[name="contactname"]');
  const contactemail = await readInputValue(page, 'input[name="contactemail"]');

  return {
    type: "website",
    sourceUrl: url,
    baseurl,
    contactname,
    contactemail
  };
}
