import { toAbsoluteUrl, uniqPush } from "./utils.js";

export async function login({ page, baseUrl, email, password }) {
  // Login zit op de root
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });

  // Juiste selectors volgens jouw HTML
  await page.fill('input[name="emailaddress"]', email);
  await page.fill('input[name="password"]', password);

  // Klik op submit, zo breed mogelijk zodat het niet faalt bij kleine verschillen
  await page.click('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Inloggen")');

  await page.waitForLoadState("networkidle");
}


export async function collectEditUrls({ page, baseUrl, pageMax }) {
  const customerEditUrls = new Set();
  const websiteEditUrls = new Set();

  for (let p = 1; p <= pageMax; p++) {
    const listUrl = `${baseUrl}/company/customers?search=&page=${p}`;
    await page.goto(listUrl, { waitUntil: "domcontentloaded" });

    // Wacht iets langer op dynamische content
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);

    // Debug: op pagina 1 altijd screenshot als er niks staat
    if (p === 1) {
      await page.screenshot({ path: "debug-customers-page1.png", fullPage: true });
    }

    const customerHrefs = await page.$$eval(
      'a[href^="/company/customer-edit/"]',
      (links) => links.map((a) => a.getAttribute("href")).filter(Boolean)
    );

    const websiteHrefs = await page.$$eval(
      'a[href^="/company/website-edit/"]',
      (links) => links.map((a) => a.getAttribute("href")).filter(Boolean)
    );

    // Log aantallen zodat je in Actions meteen ziet wat er gebeurt
    console.log(`Pagina ${p}: customer links ${customerHrefs.length}, website links ${websiteHrefs.length}`);

    for (const href of customerHrefs) customerEditUrls.add(new URL(href, baseUrl).toString());
    for (const href of websiteHrefs) websiteEditUrls.add(new URL(href, baseUrl).toString());
  }

  const customers = Array.from(customerEditUrls);
  const websites = Array.from(websiteEditUrls);

  if (customers.length === 0 && websites.length === 0) {
    throw new Error("Geen edit links gevonden. Zie debug-customers-page1.png voor wat de bot ziet.");
  }

  return { customerEditUrls: customers, websiteEditUrls: websites };
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
