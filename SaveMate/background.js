// ============================================================
// SaveMate — background.js (Simplified: Amazon, Walmart, BestBuy)
// - When product detected, fetch prices from the OTHER 2 sites
// - Store results in chrome.storage
// - Track purchase history + savings
// ============================================================

// ─── WHICH SITES TO CHECK ────────────────────────────────────
// Given the site the user is ON, return the other two to check.

const ALL_SITES = {
  amazon: {
    name: 'Amazon',
    searchUrl: (q) => `https://www.amazon.ca/s?k=${encodeURIComponent(q)}`,
    priceSelector: 'span.a-price .a-offscreen',
    linkSelector:  'a.a-link-normal.s-no-outline',
  },
  walmart: {
    name: 'Walmart',
    searchUrl: (q) => `https://www.walmart.ca/search?q=${encodeURIComponent(q)}`,
    priceSelector: '[data-automation="buybox-price"], [itemprop="price"]',
    linkSelector:  'a[data-type="itemTitles"]',
  },
  bestbuy: {
    name: 'Best Buy',
    searchUrl: (q) => `https://www.bestbuy.ca/en-ca/search?search=${encodeURIComponent(q)}`,
    priceSelector: '.price',
    linkSelector:  'a.link',
  },
};

function getComparisonSites(currentSite) {
  return Object.entries(ALL_SITES)
    .filter(([key]) => key !== currentSite)
    .map(([key, val]) => ({ key, ...val }));
}

// ─── PRICE FETCHING ──────────────────────────────────────────

function parsePrice(text) {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

async function fetchPrice(site, productTitle) {
  const url = site.searchUrl(productTitle);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try each selector
    const selectors = site.priceSelector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (el) {
        const raw = el.textContent?.trim() || el.getAttribute('content');
        const price = parsePrice(raw);
        if (price && price > 0 && price < 100000) {
          // Try to get a direct product link
          const link = doc.querySelector(site.linkSelector);
          const productUrl = link
            ? (link.href.startsWith('http') ? link.href : `https://www.${site.key === 'bestbuy' ? 'bestbuy.ca' : site.key + '.ca'}${link.getAttribute('href')}`)
            : url;

          return { price, url: productUrl, siteName: site.name, siteKey: site.key };
        }
      }
    }
  } catch (err) {
    console.warn(`[SaveMate] Could not fetch ${site.name}:`, err.message);
  }
  return null;
}

// ─── MAIN COMPARISON ─────────────────────────────────────────

async function runComparison(product) {
  const sites = getComparisonSites(product.site);

  // Fetch both sites in parallel
  const results = await Promise.allSettled(
    sites.map(site => fetchPrice(site, product.title))
  );

  const prices = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
    .sort((a, b) => a.price - b.price); // cheapest first

  return prices;
}

// ─── SAVINGS TRACKING ────────────────────────────────────────

async function recordPurchase(product) {
  const { lastComparison } = await chrome.storage.local.get('lastComparison');

  let saved = 0;
  if (lastComparison?.prices?.length > 0) {
    const cheapest = lastComparison.prices[0].price;
    saved = product.price - cheapest;
    if (saved < 0) saved = 0; // already had the best price
  }

  const record = {
    id: Date.now(),
    title: product.title,
    pricePaid: product.price,
    saved,
    site: product.site,
    purchasedAt: Date.now(),
  };

  const { history = [] } = await chrome.storage.local.get('history');
  history.unshift(record);
  if (history.length > 50) history.length = 50;
  await chrome.storage.local.set({ history });

  return { saved, record };
}

// ─── MESSAGE HANDLER ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Product found on page → run comparison
  if (msg.type === 'PRODUCT_DETECTED') {
    runComparison(msg.product).then(prices => {
      chrome.storage.local.set({
        lastComparison: { product: msg.product, prices, timestamp: Date.now() }
      });

      // Show badge if we found something cheaper
      if (prices.length > 0 && prices[0].price < msg.product.price) {
        const diff = (msg.product.price - prices[0].price).toFixed(0);
        chrome.action.setBadgeText({ text: `$${diff}` });
        chrome.action.setBadgeBackgroundColor({ color: '#00b894' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    });
    return true;
  }

  // User clicked "Yes I bought it"
  if (msg.type === 'PURCHASE_CONFIRMED') {
    recordPurchase(msg.product).then(result => sendResponse(result));
    return true;
  }

  // Popup asking for comparison results
  if (msg.type === 'GET_COMPARISON') {
    chrome.storage.local.get('lastComparison').then(data => {
      sendResponse(data.lastComparison || null);
    });
    return true;
  }

  // Popup asking for history
  if (msg.type === 'GET_HISTORY') {
    chrome.storage.local.get('history').then(({ history = [] }) => {
      const totalSaved = history.reduce((sum, r) => sum + (r.saved || 0), 0);
      sendResponse({ history, totalSaved });
    });
    return true;
  }

});
