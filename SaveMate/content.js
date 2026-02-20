// ============================================================
// SaveMate — content.js (Simplified: Amazon, Walmart, BestBuy)
// 1. Detect which of the 3 sites you're on
// 2. Extract product title + price
// 3. Send to background.js
// 4. After 3.5 min, show "Did you buy it?" popup
// ============================================================

// ─── SITE DETECTION ─────────────────────────────────────────

const hostname = window.location.hostname;

const CURRENT_SITE =
  hostname.includes('amazon')  ? 'amazon'  :
  hostname.includes('walmart') ? 'walmart' :
  hostname.includes('bestbuy') ? 'bestbuy' :
  null;

// Not one of our 3 sites — stop here
if (!CURRENT_SITE) {
  throw new Error('[SaveMate] Not a supported site.');
}

// ─── SELECTORS PER SITE ──────────────────────────────────────

const SELECTORS = {
  amazon: {
    price: [
      'span.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#price_inside_buybox',
    ],
    title: ['#productTitle'],
  },
  walmart: {
    price: [
      '[itemprop="price"]',
      'span[data-automation="buybox-price"]',
      '.price-characteristic',
    ],
    title: ['[itemprop="name"]', 'h1.prod-ProductTitle', 'h1'],
  },
  bestbuy: {
    price: [
      '.priceView-customer-price span',
      '[data-testid="customer-price"] span',
      '.pricing-price__regular-price',
    ],
    title: ['.sku-title h1', 'h1'],
  },
};

// ─── EXTRACTION ──────────────────────────────────────────────

function extractText(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText?.trim() || el.getAttribute('content')?.trim();
        if (text) return text;
      }
    } catch (_) {}
  }
  return null;
}

function parsePrice(raw) {
  if (!raw) return null;
  const match = raw.replace(/,/g, '').match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

function getProductData() {
  const sels    = SELECTORS[CURRENT_SITE];
  const rawPrice = extractText(sels.price);
  const price    = parsePrice(rawPrice);
  const title    = extractText(sels.title)?.trim();

  if (!price || !title) return null;

  return {
    title: title.substring(0, 100),
    price,
    site: CURRENT_SITE,
    url:  window.location.href,
  };
}

// ─── TIMER ───────────────────────────────────────────────────

const DELAY_MS = 3.5 * 60 * 1000;
let timer     = null;
let popupShown = false;

function startTimer(product) {
  if (timer) clearTimeout(timer);
  popupShown = false;
  timer = setTimeout(() => {
    if (!document.hidden) showBuyPopup(product);
  }, DELAY_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && timer) { clearTimeout(timer); timer = null; }
});

// ─── "DID YOU BUY IT?" POPUP ─────────────────────────────────

function injectStyles() {
  if (document.getElementById('sm-styles')) return;
  const style = document.createElement('style');
  style.id = 'sm-styles';
  style.textContent = `
    @keyframes sm-in { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
    #sm-popup {
      position:fixed; bottom:24px; right:24px; z-index:999999;
      background:#fff; border:2px solid #0071dc; border-radius:14px;
      padding:18px 20px; box-shadow:0 8px 30px rgba(0,0,0,.15);
      font-family:sans-serif; width:280px; animation:sm-in .3s ease;
    }
    #sm-popup h4 { margin:0 0 4px; font-size:15px; color:#111; }
    #sm-popup p  { margin:0 0 14px; font-size:12px; color:#555; }
    .sm-btn-row  { display:flex; gap:8px; }
    .sm-btn-yes  { flex:1; background:#0071dc; color:#fff; border:none; border-radius:8px; padding:9px; cursor:pointer; font-weight:600; font-size:13px; }
    .sm-btn-no   { flex:1; background:#f0f0f0; color:#333; border:none; border-radius:8px; padding:9px; cursor:pointer; font-size:13px; }
    .sm-dismiss  { display:block; margin-top:10px; text-align:center; font-size:11px; color:#aaa; cursor:pointer; background:none; border:none; width:100%; }
    #sm-saved-banner {
      position:fixed; bottom:24px; right:24px; z-index:999999;
      background:#fff; border:2px solid #00b894; border-radius:14px;
      padding:16px 20px; box-shadow:0 8px 30px rgba(0,0,0,.15);
      font-family:sans-serif; text-align:center; animation:sm-in .3s ease;
    }
    #sm-saved-banner .sm-emoji { font-size:26px; }
    #sm-saved-banner h4 { margin:6px 0 2px; font-size:15px; color:#111; }
    #sm-saved-banner p  { margin:0; font-size:12px; color:#555; }
  `;
  document.head.appendChild(style);
}

function showBuyPopup(product) {
  if (popupShown) return;
  popupShown = true;
  injectStyles();
  document.getElementById('sm-popup')?.remove();

  const popup = document.createElement('div');
  popup.id = 'sm-popup';
  popup.innerHTML = `
    <h4>🛍️ Did you buy it?</h4>
    <p>${product.title.substring(0, 55)}... at $${product.price.toFixed(2)}</p>
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
      if (res?.saved > 0) showSavedBanner(res.saved);
    });
  };
  document.getElementById('sm-no').onclick = () => {
    popup.remove();
    startTimer(product); // restart
  };
  document.getElementById('sm-dismiss').onclick = () => popup.remove();
}

function showSavedBanner(saved) {
  const banner = document.createElement('div');
  banner.id = 'sm-saved-banner';
  banner.innerHTML = `
    <div class="sm-emoji">🎉</div>
    <h4>You saved $${saved.toFixed(2)}!</h4>
    <p>SaveMate found you the best price.</p>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 5000);
}

// ─── INIT ────────────────────────────────────────────────────

function init() {
  const product = getProductData();
  if (!product) return;

  chrome.runtime.sendMessage({ type: 'PRODUCT_DETECTED', product });
  startTimer(product);
}

setTimeout(init, 1800); // wait for JS-rendered prices
