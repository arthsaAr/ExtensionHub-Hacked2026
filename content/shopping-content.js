//rules for each site
const SITES = {
  amazon: {
    match:     h => h.includes('amazon'),
    isProduct: path => /\/dp\/[A-Z0-9]{10}/i.test(path),
    getTitle:  path => {
      const parts = path.split('/').filter(Boolean);
      const i = parts.indexOf('dp');
      if (i > 0 && parts[i - 1].includes('-')) {
        return parts[i - 1];
      } else {
        return null;
      }
    },
    priceSelectors: [
      'span.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#price_inside_buybox',
      '.priceToPay .a-offscreen',
      '#corePrice_feature_div .a-price .a-offscreen',
      '.a-price .a-offscreen',
    ],
  },

  walmart: {
    match:     h => h.includes('walmart'),
    isProduct: path => /\/ip\//.test(path),
    getTitle:  path => {
      const parts = path.split('/');
      const i = parts.indexOf('ip');
      const slug = parts[i + 1];
      if (slug && !/^\d+$/.test(slug)) {
        return slug;
      } else {
        return null;
      }
    },
    priceSelectors: [
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
  },

  bestbuy: {
    match:     h => h.includes('bestbuy'),
    isProduct: path => path.includes('/en-ca/product/') || /\/\d+\.aspx/.test(path),
    getTitle:  path => {
      const parts = path.split('/').filter(Boolean);
      const i = parts.findIndex(p => /^\d+(\.aspx)?$/.test(p));
      if (i > 0) {
        return parts[i - 1];
      } else {
        return null;
      }
    },
    priceSelectors: [
      '[data-automation="product-price"]',
      '.priceValue',
      '.sr-only + span',
      '[class*="price"] [class*="value"]',
      '[itemprop="price"]',
    ],
  },

  superstore: {
    match:     h => h.includes('superstore') || h.includes('realcanadiansuperstore'),
    isProduct: path => path.includes('/p/') || path.includes('/product/') || /\/\d{5,}/.test(path),
    getTitle:  path => {
      const parts = path.split('/').filter(Boolean);
      const i = parts.findIndex(p => p === 'p' || p === 'product');
      const slug = parts[i + 1];
      const isCode = slug && (/^[\d_]+$/.test(slug) || /^\d+[_A-Z]+$/i.test(slug));
      if (slug && !isCode) {
        return slug;
      } else {
        return null;
      }
    },
    priceSelectors: [
      '[data-code="price"]',
      '.price--sale',
      '.price',
      '[itemprop="price"]',
      '[class*="Price"]',
    ],
  },
};

//checking which specific site we are on (hostname)
const CURRENT_SITE = Object.keys(SITES).find(
  key => SITES[key].match(window.location.hostname)
) ?? null;

if (!CURRENT_SITE) {
  throw new Error('[Hub] Not a supported site.');
}

const site = SITES[CURRENT_SITE];

//checking URL pattern to see if we are on a product page
function isProductPage() {
  return site.isProduct(window.location.pathname);
}

//getting product name from URL
function getTitleFromUrl() {
  try {
    const fromUrl = site.getTitle(window.location.pathname);
    if (fromUrl) {
      return fromUrl.replace(/-/g, ' ').trim();
    }
  } catch (_) {}

  // Universal DOM fallback
  const el = document.querySelector('title, h1');
  if (el) {
    return el.textContent.split(/[:|–\-]/)[0].trim();
  }
  return null;
}

//cleaning the overall title by removing common filler words
function cleanTitle(raw) {
  if (!raw) {
    return null;
  }
  return raw
    .replace(/\b(with|the|a|an|for|set of|pack of|lot of)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .substring(0, 100);
}

//trying each CSS selector for the site until we find a valid price
function getPrice() {
  for (const sel of site.priceSelectors) {
    try {
      const el = document.querySelector(sel);
      if (!el) {
        continue;
      }
      const raw =
        el.getAttribute('content') ||
        el.innerText?.trim()       ||
        el.textContent?.trim();
      if (!raw || raw.length === 0 || raw.length >= 30) {
        continue;
      }
      const m = raw.replace(/,/g, '').match(/\d+\.?\d*/);
      if (!m) {
        continue;
      }
      const p = parseFloat(m[0]);
      if (p > 0 && p < 100000) {
        return p;
      }
    } catch (_) {}
  }
  return null;
}

//combining everything we extracted into one object
function getProductData() {
  if (!isProductPage()) {
    return null;
  }

  const rawTitle = getTitleFromUrl();
  const title    = cleanTitle(rawTitle);
  const price    = getPrice();

  console.log(`[Hub] Site: ${CURRENT_SITE} | Title: "${title}" | Price: ${price}`);

  if (!title) {
    return null;
  }
  // Price can be null — we still want to show comparison prices

  return {
    title: title.substring(0, 120),
    price: price,
    site:  CURRENT_SITE,
    url:   window.location.href,
  };
}

let lastUrl   = '';
let lastKey   = '';
let initTimer = null;

//extracting the unique ID for the current product
function getProductKey() {
  const path = window.location.pathname;

  if (CURRENT_SITE === 'amazon') {
    const m = path.match(/\/dp\/([A-Z0-9]{10})/i);
    if (m) {
      return m[1];
    } else {
      return path;
    }
  }

  if (CURRENT_SITE === 'walmart') {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1];
  }

  return path;
}

//watching for URL changes every 800ms (handles SPA navigation)
setInterval(() => {
  const currentUrl = window.location.href;
  const currentKey = getProductKey();

  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;

    if (currentKey !== lastKey) {
      lastKey = currentKey;
      chrome.runtime.sendMessage({ type: 'CLEAR_COMPARISON' });
      if (initTimer) {
        clearTimeout(initTimer);
      }
      initTimer = setTimeout(init, 2000);
    }
  }
}, 800);

//the popup logic
let buyTimer   = null;
let popupShown = false;
const DELAY_MS = 15 * 1000;

function startTimer(product) {
  if (buyTimer) {
    clearTimeout(buyTimer);
  }
  popupShown = false;
  buyTimer = setTimeout(() => {
    if (!document.hidden) {
      showBuyPopup(product);
    }
  }, DELAY_MS);
}

//adding the popup CSS to the page, only once
function injectStyles() {
  if (document.getElementById('sm-styles')) {
    return;
  }
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

//rendering the "did you buy it?" popup onto the page
function showBuyPopup(product) {
  if (popupShown || !product?.price) {
    return;
  }
  popupShown = true;
  injectStyles();
  document.getElementById('sm-popup')?.remove();

  let priceText = '';
  if (product.price) {
    priceText = 'at $' + product.price.toFixed(2);
  }

  const popup = document.createElement('div');
  popup.id = 'sm-popup';
  popup.innerHTML = `
    <h4>🛍️ Did you buy it?</h4>
    <p>${product.title.substring(0, 55)}... ${priceText}</p>
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
        b.innerHTML = `<div style="font-size:26px">🎉</div><h4 style="margin:6px 0 2px;font-size:15px;color:#111">You saved $${res.saved.toFixed(2)}!</h4><p style="margin:0;font-size:12px;color:#555">Hub found you the best price.</p>`;
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 5000);
      }
    });
  };

  document.getElementById('sm-no').onclick = () => {
    popup.remove();
    startTimer(product);
  };

  document.getElementById('sm-dismiss').onclick = () => {
    popup.remove();
  };
}

//entry point — detects product and fires messages to background
function init() {
  const product = getProductData();
  if (!product) {
    console.log('[Hub] Not a product page, skipping.');
    return;
  }
  console.log('[Hub] Product detected:', product);
  chrome.runtime.sendMessage({ type: 'PRODUCT_DETECTED', product });
  if (product.price) {
    startTimer(product);
  }
}

// Wait for page to fully render before extracting
setTimeout(init, 1800);