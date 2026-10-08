/**
 * Dakahlia food scraper v5 — lightweight, crash-tolerant.
 *
 * Strategy:
 *   - One read per query after a fixed number of scrolls (10).
 *   - Use page.mouse.wheel for scrolling (lighter than JS evaluate).
 *   - Drop the per-round dedupe loop (was causing crashes).
 *   - On ANY page error, just log and move to the next city.
 *   - Run each city in its own context; close between cities.
 *
 * Trade-off: less exhaustive scroll = fewer results per city,
 * but the run completes. The v4 run captured 137 places from
 * 2 cities before the page died; v5 should at least match and
 * probably go further by not crashing.
 */

const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");

chromium.use(stealth());

const OUT_DIR = path.resolve(__dirname, "..");
const PROGRESS = path.join(OUT_DIR, "progress.json");
const FINAL = path.join(OUT_DIR, "dakahlia_food.csv");
const FINAL_JSON = path.join(OUT_DIR, "dakahlia_food.json");
const LOG = path.join(OUT_DIR, "run.log");

const cities = JSON.parse(
  fs.readFileSync(path.join(OUT_DIR, "cities.json"), "utf8")
);

const QUERIES = [
  { lang: "en", text: (c) => `restaurants cafes in ${c.name} Dakahlia Egypt` },
  { lang: "ar", text: (c) => `مطاعم كافيهات ${c.ar} الدقهلية` },
];

const SCROLL_COUNT = 15;
const SCROLL_PAUSE_MS = 1500;

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  try { fs.appendFileSync(LOG, msg); } catch {}
  process.stdout.write(msg);
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS, "utf8"));
  } catch {
    return { done: [], seenNames: {}, places: {} };
  }
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS, JSON.stringify(p), "utf8");
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
  if (/[,"]/.test(s)) return `"${s}"`;
  return s;
}

function writeOutputs(places) {
  const cols = [
    "name", "category", "rating", "reviews",
    "address", "lat", "lng", "place_id", "google_maps_url",
    "city_source", "query_lang",
  ];
  const rows = [cols.join(",")];
  for (const p of places) {
    rows.push(cols.map((c) => csvEscape(p[c])).join(","));
  }
  fs.writeFileSync(FINAL, rows.join("\n"), "utf8");
  fs.writeFileSync(FINAL_JSON, JSON.stringify(places, null, 2), "utf8");
}

async function readCards(page) {
  return await page.evaluate(() => {
    const anchors = document.querySelectorAll(
      "div[role='feed'] a[href*='/maps/place/']"
    );
    const seen = new Set();
    const out = [];
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const name = (a.getAttribute("aria-label") || "").trim();
      if (!name || !href || seen.has(name)) continue;
      seen.add(name);

      let rating = "", reviews = "", category = "", address = "";
      let card = a.closest("div[role='article']") || a.parentElement;
      if (card) {
        const txt = (card.innerText || "").replace(/\s+/g, " ");
        const rm = txt.match(/(\d[.,]\d)\s*\(?([\d ,\u0660-\u066D]+)\)?/);
        if (rm) { rating = rm[1].replace(".", ","); reviews = rm[2].replace(/[^\d]/g, ""); }
        const lines = txt.split(/[\n\u2028]/).map(s => s.trim()).filter(Boolean);
        if (lines.length >= 2) {
          for (let i = 1; i < Math.min(lines.length, 4); i++) {
            const ln = lines[i];
            if (!/\d/.test(ln) && ln.length >= 3 && ln.length < 40) { category = ln; break; }
          }
        }
        for (let i = 1; i < lines.length; i++) {
          const ln = lines[i];
          if (/Street|St\b|Straße|St\.|Road|\u0634\u0627\u0631\u0639/i.test(ln) ||
              (ln.length > 12 && ln.length < 80 && !/\d[.,]\d/.test(ln))) {
            address = ln; break;
          }
        }
      }
      let place_id = "";
      const pm = href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
      if (pm) place_id = pm[1];
      let lat = "", lng = "";
      const lm = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (lm) { lat = +lm[1]; lng = +lm[2]; }
      out.push({ name, category, rating, reviews, address, place_id, lat, lng, google_maps_url: href.substring(0, 400) });
    }
    return out;
  });
}

async function scrapeQuery(context, city, query, progress) {
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query.text(city))}`;
  log(`  → ${query.lang}: ${query.text(city)}`);

  let page;
  try {
    page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    let html = "";
    try { html = await page.content(); } catch {}
    if (/unusual traffic|verify you're human|recaptcha/i.test(html)) {
      throw new Error("CAPTCHA_HIT");
    }

    const consent = await page.$("button[aria-label*='Accept'], button[aria-label*='agree']");
    if (consent) await consent.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(800);

    await page.waitForSelector("div[role='feed']", { timeout: 12000 }).catch(() => null);
  } catch (e) {
    if (e.message === "CAPTCHA_HIT") throw e;
    log(`    setup error: ${e.message}`);
    try { await page.close(); } catch {}
    return 0;
  }

  // Scroll N times using mouse wheel
  for (let i = 0; i < SCROLL_COUNT; i++) {
    try {
      // Hover the feed first to focus it for wheel events
      if (i === 0) {
        const feed = await page.$("div[role='feed']");
        if (feed) {
          const box = await feed.boundingBox();
          if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        }
      }
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(SCROLL_PAUSE_MS);
    } catch (e) {
      log(`    scroll ${i} crashed: ${e.message}`);
      break;
    }
  }

  let added = 0;
  try {
    const cards = await readCards(page);
    const seenKey = (n) => `${city.name}|${query.lang}|${n.toLowerCase()}`;
    for (const c of cards) {
      if (!c.name) continue;
      const key = seenKey(c.name);
      if (progress.seenNames[key]) continue;
      progress.seenNames[key] = 1;
      c.city_source = city.name;
      c.query_lang = query.lang;
      const dedupeKey = c.place_id || `${city.name}|${query.lang}|${c.name}`;
      progress.places[dedupeKey] = c;
      added++;
    }
    log(`    +${added} new (total ${cards.length} visible in ${city.name}/${query.lang})`);
  } catch (e) {
    log(`    readCards crashed: ${e.message}`);
  }

  try { await page.close(); } catch {}
  return added;
}

async function scrapeCity(browser, city, progress) {
  if (progress.done.includes(city.name)) {
    log(`SKIP ${city.name}`);
    return true;
  }
  log(`CITY ${city.name} (${city.ar})`);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    timezoneId: "Africa/Cairo",
  });

  try {
    for (const q of QUERIES) {
      try {
        await scrapeQuery(context, city, q, progress);
      } catch (e) {
        if (e.message === "CAPTCHA_HIT") {
          log(`!!! CAPTCHA hit on ${city.name}/${q.lang}. Halting.`);
          await context.close();
          saveProgress(progress);
          writeOutputs(Object.values(progress.places));
          return false;
        }
        log(`    query error: ${e.message}`);
      }
      saveProgress(progress);
      writeOutputs(Object.values(progress.places));
      await new Promise(r => setTimeout(r, 1500));
    }
    progress.done.push(city.name);
    saveProgress(progress);
    writeOutputs(Object.values(progress.places));
  } finally {
    await context.close().catch(() => {});
  }
  return true;
}

(async () => {
  log("=== START v5 ===");
  const progress = loadProgress();
  log(`Loaded ${Object.keys(progress.places).length} places, ${progress.done.length} cities done.`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--no-first-run",
      ],
    });
  } catch (e) {
    log(`!!! browser launch failed: ${e.message}`);
    process.exit(2);
  }

  for (const city of cities) {
    const ok = await scrapeCity(browser, city, progress);
    if (!ok) break;
    await new Promise(r => setTimeout(r, 2500));
  }

  await browser.close().catch(() => {});
  log(`=== DONE v5 === ${Object.keys(progress.places).length} unique places across ${progress.done.length} cities`);
  process.exit(0);
})().catch((e) => {
  const msg = e.stack || e.message;
  try { fs.appendFileSync(LOG, `[FATAL v5] ${msg}\n`); } catch {}
  process.stderr.write(`FATAL v5: ${msg}\n`);
  process.exit(1);
});