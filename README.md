# CookieCode scraper

Dit project logt in op het CookieCode portal, loopt alle klantpagina's langs, bezoekt elke klant edit en website edit pagina, leest velden uit en stuurt records naar een webhook.

## Installatie

1. Installeer dependencies
   npm install

2. Installeer Playwright browser dependencies
   npm run pw:install

3. Maak een .env bestand op basis van .env.example

4. Run
   npm run scrape

## Output

De webhook krijgt batches met payload:
{
  "scrapedAt": "ISO timestamp",
  "count": 50,
  "records": [
    { ... }
  ]
}

Records hebben type:
- customer
- website

## Let op

Het script leest alleen. Het klikt nergens op opslaan en vult geen velden in.
