
const hostname = window.location.hostname;

const CURRENT_SITE =
  hostname.includes('amazon')              ? 'amazon'     :
  hostname.includes('walmart')             ? 'walmart'    :
  hostname.includes('bestbuy')             ? 'bestbuy'    :
  hostname.includes('superstore') ||
  hostname.includes('realcanadiansuperstore') ? 'superstore' :
  null;

if (!CURRENT_SITE) {
  // Silently exit on unsupported sites
  throw new Error('[SaveMate] Not a supported site.');
}

// ─── IS THIS A PRODUCT PAGE? ─────────────────────────────────

function isProductPage() {
  const path = window.location.pathname;
  if (CURRENT_SITE === 'amazon')     return /\/dp\/[A-Z0-9]{10}/i.test(path);
  // Walmart CA uses /en/ip/... or /ip/... 
  if (CURRENT_SITE === 'walmart')    return /\/ip\//.test(path);
  if (CURRENT_SITE === 'bestbuy')    return path.includes('/en-ca/product/') || /\/\d+\.aspx/.test(path);
  // Superstore uses /p/name/code or just check for a product code at end
  if (CURRENT_SITE === 'superstore') return path.includes('/p/') || path.includes('/product/') || /\/\d{5,}/.test(path);
  return false;
}

// ─── TITLE FROM URL ──────────────────────────────────────────
// URL slug is always available immediately — no JS render wait.

function getTitleFromUrl() {
  const path = window.location.pathname;
  try {
    if (CURRENT_SITE === 'walmart') {
      // Walmart CA: /en/ip/Product-Name-Here/ID  OR  /ip/Product-Name/ID
      const parts = path.split('/');
      const ipIdx = parts.indexOf('ip');
      if (ipIdx >= 0 && parts[ipIdx + 1]) {
        const slug = parts[ipIdx + 1];
        // Skip if it's a pure numeric ID (sometimes Walmart puts ID first)
        if (!/^\d+$/.test(slug)) {
          return slug.replace(/-/g, ' ').trim();
        }
      }
      // Fallback: DOM h1 (Walmart renders this quickly)
      const h1 = document.querySelector('h1[itemprop="name"], h1[class*="prod-title"], h1');
      if (h1) return h1.textContent.trim().split('\n')[0].trim();
    }

    if (CURRENT_SITE === 'amazon') {
      // /Product-Name-Here/dp/ASIN  OR  /dp/ASIN (no name)
      const parts = path.split('/').filter(Boolean);
      const dpIdx = parts.indexOf('dp');
      if (dpIdx > 0 && parts[dpIdx - 1].includes('-')) {
        return parts[dpIdx - 1].replace(/-/g, ' ').trim();
      }
      // Fallback: try page <title> tag (usually "Product Name : Amazon.ca")
      const titleEl = document.querySelector('title');
      if (titleEl) {
        return titleEl.textContent.split(':')[0].split('|')[0].trim();
      }
    }

    if (CURRENT_SITE === 'bestbuy') {
      // /en-ca/product/brand-product-name/12345.aspx
      const parts = path.split('/').filter(Boolean);
      // Find the segment before the numeric ID segment
      const productSegIdx = parts.findIndex(p => /^\d+\.aspx$/.test(p) || /^\d+$/.test(p));
      if (productSegIdx > 0) {
        return parts[productSegIdx - 1].replace(/-/g, ' ').trim();
      }
    }

    if (CURRENT_SITE === 'superstore') {
      // Superstore URL: /p/Product-Name-Here/21302823_EA
      // The slug BEFORE the last segment is the name; the last is a numeric code
      const parts = path.split('/').filter(Boolean);
      const pIdx  = parts.findIndex(p => p === 'p' || p === 'product');
      if (pIdx >= 0 && parts[pIdx + 1]) {
        const candidate = parts[pIdx + 1];
        // Skip if it's a pure numeric/code segment like "21302823_EA" or "123456"
        const isCode = /^[\d_]+$/.test(candidate) || /^\d+[_A-Z]+$/i.test(candidate);
        if (!isCode) {
          return candidate.replace(/-/g, ' ').trim();
        }
      }
      // Fallback: use the page <title> — Superstore sets it to the product name
      const titleEl = document.querySelector('title, h1');
      if (titleEl) {
        return titleEl.textContent.split('|')[0].split('-')[0].split(':')[0].trim();
      }
    }
  } catch (_) {}

  // Universal fallback: page <title>
  const titleEl = document.querySelector('title');
  if (titleEl) {
    return titleEl.textContent.split(':')[0].split('|')[0].split('-')[0].trim();
  }
  return null;
}

// ─── TITLE CLEANUP ───────────────────────────────────────────
// Remove junk like sizes, colors, variant codes from the slug
// so the cross-site search finds the right product type.

function cleanTitle(raw) {
  if (!raw) return null;
  return raw
    // Remove common noise patterns
    .replace(/\b(with|the|a|an|for|set of|pack of|lot of)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .substring(0, 100);
}

// ─── PRICE FROM DOM ──────────────────────────────────────────

const PRICE_SELECTORS = {
  amazon: [
    'span.a-price .a-offscreen',          // Main price
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#price_inside_buybox',
    '.priceToPay .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '.a-price .a-offscreen',
  ],
  walmart: [
    // Walmart CA — try every known price selector pattern
    '[data-automation="buybox-price"]',
    'span[data-automation="buybox-price"]',
    '[data-testid="price-wrap"] span',
    '[data-testid="buybox-price-container"] span',
    '[class*="PriceDisplay"] [class*="price"]',
    '[class*="buybox"] [class*="price"]',
    '[itemprop="price"]',
    '.price-characteristic',
    '[class*="priceDisplay"]',
    '[class*="price-group"]',
    'span[class*="price"]',
  ],
  bestbuy: [
    '[data-automation="product-price"]',
    '.priceValue',
    '.sr-only + span',
    '[class*="price"] [class*="value"]',
    '[itemprop="price"]',
  ],
  superstore: [
    '[data-code="price"]',
    '.price--sale',
    '.price',
    '[itemprop="price"]',
    '[class*="Price"]',
  ],
};

function extractText(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const t =
          el.getAttribute('content') ||   // itemprop="price" uses content attr
          el.innerText?.trim()          ||
          el.textContent?.trim();
        if (t && t.length > 0 && t.length < 30) return t;
      }
    } catch (_) {}
  }
  return null;
}

function parsePrice(raw) {
  if (!raw) return null;
  const m = raw.replace(/,/g, '').match(/\d+\.?\d*/);
  if (!m) return null;
  const p = parseFloat(m[0]);
  return (p > 0 && p < 100000) ? p : null;
}

// ─── MAIN DETECTION ──────────────────────────────────────────

function getProductData() {
  if (!isProductPage()) return null;

  const rawTitle = getTitleFromUrl();
  const title    = cleanTitle(rawTitle);
  const rawPrice = extractText(PRICE_SELECTORS[CURRENT_SITE]);
  const price    = parsePrice(rawPrice);

  console.log(`[SaveMate] Site: ${CURRENT_SITE} | Title: "${title}" | Price: ${price}`);

  if (!title) return null;      // Need at least a title
  // Price can be null — we still want to show comparison prices

  return {
    title:  title.substring(0, 120),
    price:  price,
    site:   CURRENT_SITE,
    url:    window.location.href,
  };
}

// ─── SPA NAVIGATION WATCHER ──────────────────────────────────

let lastUrl  = '';
let lastKey  = '';
let initTimer = null;

function getProductKey() {
  const path = window.location.pathname;
  if (CURRENT_SITE === 'amazon')  { const m = path.match(/\/dp\/([A-Z0-9]{10})/i); return m ? m[1] : path; }
  if (CURRENT_SITE === 'walmart') { const parts = path.split('/').filter(Boolean); return parts[parts.length - 1]; }
  return path;
}

setInterval(() => {
  const currentUrl = window.location.href;
  const currentKey = getProductKey();

  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;

    if (currentKey !== lastKey) {
      lastKey = currentKey;
      chrome.runtime.sendMessage({ type: 'CLEAR_COMPARISON' });
      if (initTimer) clearTimeout(initTimer);
      initTimer = setTimeout(init, 2000);
    }
  }
}, 800);

// ─── BUY POPUP (3.5 min timer) ───────────────────────────────

let buyTimer   = null;
let popupShown = false;
const DELAY_MS = 15 * 1000;

function startTimer(product) {
  if (buyTimer) clearTimeout(buyTimer);
  popupShown = false;
  buyTimer = setTimeout(() => {
    if (!document.hidden) showBuyPopup(product);
  }, DELAY_MS);
}

function injectStyles() {
  if (document.getElementById('sm-styles')) return;
  const s = document.createElement('style');
  s.id = 'sm-styles';
  s.textContent = `
    @keyframes sm-in { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
    #sm-popup {
      position:fixed;bottom:24px;right:24px;z-index:999999;
      background:#fff;border:2px solid #0071dc;border-radius:14px;
      padding:18px 20px;box-shadow:0 8px 30px rgba(0,0,0,.18);
      font-family:sans-serif;width:280px;animation:sm-in .3s ease;
    }
    #sm-popup h4{margin:0 0 4px;font-size:15px;color:#111}
    #sm-popup p{margin:0 0 14px;font-size:12px;color:#555}
    .sm-btn-row{display:flex;gap:8px}
    .sm-btn-yes{flex:1;background:#0071dc;color:#fff;border:none;border-radius:8px;padding:9px;cursor:pointer;font-weight:600;font-size:13px}
    .sm-btn-no{flex:1;background:#f0f0f0;color:#333;border:none;border-radius:8px;padding:9px;cursor:pointer;font-size:13px}
    .sm-dismiss{display:block;margin-top:10px;text-align:center;font-size:11px;color:#aaa;cursor:pointer;background:none;border:none;width:100%}
    #sm-saved-banner{position:fixed;bottom:24px;right:24px;z-index:999999;background:#fff;border:2px solid #00b894;border-radius:14px;padding:16px 20px;box-shadow:0 8px 30px rgba(0,0,0,.15);font-family:sans-serif;text-align:center;animation:sm-in .3s ease}
  `;
  document.head.appendChild(s);
}

function showBuyPopup(product) {
  if (popupShown || !product?.price) return;
  popupShown = true;
  injectStyles();
  document.getElementById('sm-popup')?.remove();
  const popup = document.createElement('div');
  popup.id = 'sm-popup';
  popup.innerHTML = `
    <h4>🛍️ Did you buy it?</h4>
    <p>${product.title.substring(0, 55)}... ${product.price ? 'at $' + product.price.toFixed(2) : ''}</p>
    <div class="sm-btn-row">
      <button class="sm-btn-yes" id="sm-yes">✅ Yes!</button>
      <button class="sm-btn-no"  id="sm-no">Not yet</button>
    </div>
    <button class="sm-dismiss" id="sm-dismiss">Dismiss</button>
  `;
  document.body.appendChild(popup);
  document.getElementById('sm-yes').onclick = () => {
    popup.remove();
    chrome.runtime.sendMessage({ type: 'PURCHASE_CONFIRMED', product }, (res) => {
      if (res?.saved > 0) {
        const b = document.createElement('div');
        b.id = 'sm-saved-banner';
        b.innerHTML = `<div style="font-size:26px">🎉</div><h4 style="margin:6px 0 2px;font-size:15px;color:#111">You saved $${res.saved.toFixed(2)}!</h4><p style="margin:0;font-size:12px;color:#555">SaveMate found you the best price.</p>`;
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 5000);
      }
    });
  };
  document.getElementById('sm-no').onclick     = () => { popup.remove(); startTimer(product); };
  document.getElementById('sm-dismiss').onclick = () => popup.remove();
}

// ─── INIT ────────────────────────────────────────────────────

function init() {
  const product = getProductData();
  if (!product) {
    console.log('[SaveMate] Not a product page, skipping.');
    return;
  }
  console.log('[SaveMate] Product detected:', product);
  chrome.runtime.sendMessage({ type: 'PRODUCT_DETECTED', product });
  if (product.price) startTimer(product);
}

// Wait for page to fully render before extracting
setTimeout(init, 1800);