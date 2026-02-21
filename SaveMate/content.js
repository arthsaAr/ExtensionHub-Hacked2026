// ============================================================
// SaveMate — content.js (Amazon + Walmart)
// Extracts product title + price from current page.
// Title is pulled from the URL slug (most reliable).
// Price is pulled from the DOM.
// ============================================================

const hostname = window.location.hostname;

const CURRENT_SITE =
  hostname.includes('amazon')  ? 'amazon'  :
  hostname.includes('walmart') ? 'walmart' :
  null;

if (!CURRENT_SITE) throw new Error('[SaveMate] Not a supported site.');

// ─── TITLE FROM URL ──────────────────────────────────────────
// Far more reliable than DOM — always available immediately,
// no React rendering delay, no breadcrumb confusion.

function getTitleFromUrl() {
  const path = window.location.pathname;
  try {
    if (CURRENT_SITE === 'walmart') {
      // /en/ip/Mainstays-Montclair-5-Piece-Dining-Set/77UDZY2DVYAV
      const parts = path.split('/');
      const ipIdx = parts.indexOf('ip');
      if (ipIdx >= 0 && parts[ipIdx + 1]) {
        return parts[ipIdx + 1].replace(/-/g, ' ').trim();
      }
    }
    if (CURRENT_SITE === 'amazon') {
      // /PET-Jersey-Medium-Winnipeg-Jets/dp/B0889B9HMM
      const parts = path.split('/').filter(Boolean);
      const dpIdx = parts.indexOf('dp');
      if (dpIdx > 0 && parts[dpIdx - 1].includes('-')) {
        return parts[dpIdx - 1].replace(/-/g, ' ').trim();
      }
    }
  } catch (_) {}
  return null;
}

// ─── PRICE FROM DOM ──────────────────────────────────────────

const PRICE_SELECTORS = {
  amazon: [
    'span.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#price_inside_buybox',
    '.a-price .a-offscreen',
  ],
  walmart: [
    '[data-automation="buybox-price"]',
    'span[itemprop="price"]',
    '.price-characteristic',
    '[data-testid="price-wrap"] span',
  ],
};

function extractText(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const t = el.innerText?.trim() || el.getAttribute('content')?.trim();
        if (t) return t;
      }
    } catch (_) {}
  }
  return null;
}

function parsePrice(raw) {
  if (!raw) return null;
  const m = raw.replace(/,/g, '').match(/\d+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

function getProductData() {
  const title = getTitleFromUrl();
  const raw   = extractText(PRICE_SELECTORS[CURRENT_SITE]);
  const price = parsePrice(raw);

  if (!title || !price) return null;

  return {
    title: title.substring(0, 120),
    price,
    site:  CURRENT_SITE,
    url:   window.location.href,
  };
}

// ─── SPA NAVIGATION WATCHER ──────────────────────────────────
// Amazon and Walmart are SPAs — URL changes without page reload.

let lastUrl = window.location.href;
let timer   = null;
let popupShown = false;

function getProductKey() {
  const path = window.location.pathname;
  if (CURRENT_SITE === 'amazon') {
    const m = path.match(/\/dp\/([A-Z0-9]{10})/);
    return m ? m[1] : path;
  }
  if (CURRENT_SITE === 'walmart') {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1]; // last segment = product ID
  }
  return path;
}

let lastKey = getProductKey();

setInterval(() => {
  const currentUrl = window.location.href;
  const currentKey = getProductKey();

  if (currentUrl !== lastUrl && currentKey !== lastKey) {
    lastUrl = currentUrl;
    lastKey = currentKey;

    // Clear stale data and reset
    chrome.runtime.sendMessage({ type: 'CLEAR_COMPARISON' });
    if (timer) { clearTimeout(timer); timer = null; }
    popupShown = false;

    // Re-init after page renders
    setTimeout(init, 2000);
  }
}, 500);

// ─── TIMER + BUY POPUP ───────────────────────────────────────

const DELAY_MS = 3.5 * 60 * 1000;

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

function injectStyles() {
  if (document.getElementById('sm-styles')) return;
  const s = document.createElement('style');
  s.id = 'sm-styles';
  s.textContent = `
    @keyframes sm-in { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
    #sm-popup {
      position:fixed;bottom:24px;right:24px;z-index:999999;
      background:#fff;border:2px solid #0071dc;border-radius:14px;
      padding:18px 20px;box-shadow:0 8px 30px rgba(0,0,0,.15);
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
  if (!product) return;
  chrome.runtime.sendMessage({ type: 'PRODUCT_DETECTED', product });
  startTimer(product);
}

setTimeout(init, 1500);