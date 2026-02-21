// ============================================================
// SaveMate — background.js
// Cross-site price fetching using real hidden browser tabs.
// Both Amazon and Walmart block server-side fetch — this
// approach loads their search pages in a real (hidden) tab
// and injects a script to pull the price from the live DOM.
// ============================================================

// ─── URL BUILDERS ────────────────────────────────────────────

function buildSearchUrl(site, query) {
  const q = encodeURIComponent(query);
  if (site === 'amazon')  return `https://www.amazon.ca/s?k=${q}`;
  if (site === 'walmart') return `https://www.walmart.ca/search?q=${q}`;
  return null;
}

// ─── TITLE EXTRACTION FROM URL ───────────────────────────────
// Both sites embed the product name in the URL slug.
// This is the most reliable source — no DOM timing issues.

function extractTitleFromUrl(url, site) {
  try {
    const path = new URL(url).pathname;
    if (site === 'walmart') {
      // /en/ip/Mainstays-Montclair-5-Piece-Dining-Set/77UDZY2DVYAV
      const parts = path.split('/');
      const ipIdx = parts.indexOf('ip');
      if (ipIdx >= 0 && parts[ipIdx + 1]) {
        return parts[ipIdx + 1].replace(/-/g, ' ').trim();
      }
    }
    if (site === 'amazon') {
      // /PET-Jersey-Medium-Winnipeg-Jets/dp/B0889B9HMM
      const parts = path.split('/').filter(Boolean);
      const dpIdx = parts.indexOf('dp');
      if (dpIdx > 0) {
        return parts[dpIdx - 1].replace(/-/g, ' ').trim();
      }
      // fallback: first path segment
      if (parts[0] && parts[0].includes('-')) {
        return parts[0].replace(/-/g, ' ').trim();
      }
    }
  } catch (_) {}
  return null;
}

// ─── CLEAN SEARCH QUERY ──────────────────────────────────────
// Trim to the most meaningful 5 words for cross-site search.
// "Mainstays Montclair 5 Piece Outdoor Dining Set Light Grey"
//   → "Mainstays Montclair 5 Piece Outdoor"

function cleanQuery(title) {
  const stopWords = new Set(['with','the','a','an','and','or','for','in','on','of','by','to']);
  return title
    .split(' ')
    .map(w => w.trim())
    .filter(w => w.length > 1 && !stopWords.has(w.toLowerCase()))
    .slice(0, 5)
    .join(' ');
}

// ─── FETCH PRICE VIA HIDDEN TAB ──────────────────────────────
// Opens a hidden tab, waits for it to load, injects a script
// to extract the first price from the search results page,
// then closes the tab.

function fetchPriceViaTab(searchUrl, targetSite) {
  return new Promise((resolve) => {
    let tabId = null;
    const timeout = setTimeout(() => {
      if (tabId) chrome.tabs.remove(tabId).catch(() => {});
      resolve(null);
    }, 15000); // 15 second hard timeout

    chrome.tabs.create({ url: searchUrl, active: false }, (tab) => {
      tabId = tab.id;

      // Listen for the tab to finish loading
      function onUpdated(id, info) {
        if (id !== tabId || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);

        // Give JS frameworks a moment to render prices
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId },
            func: extractFirstPriceFromPage,
            args: [targetSite],
          }, (results) => {
            clearTimeout(timeout);
            chrome.tabs.remove(tabId).catch(() => {});
            const result = results?.[0]?.result;
            resolve(result || null);
          });
        }, 2500); // wait 2.5s for React to render
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

// ─── PRICE EXTRACTOR (runs inside hidden tab) ─────────────────
// This function is injected into the search results page.
// It reads the live DOM — no blocking, no CORS, full JS rendered.

function extractFirstPriceFromPage(site) {
  function parsePrice(text) {
    if (!text) return null;
    const m = text.replace(/,/g, '').match(/\d+\.?\d*/);
    return m ? parseFloat(m[0]) : null;
  }

  function trySelectors(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.innerText?.trim() || el.textContent?.trim();
          if (t) return t;
        }
      } catch(_) {}
    }
    return null;
  }

  let price = null;
  let productUrl = window.location.href;
  let productTitle = null;

  if (site === 'amazon') {
    // Amazon search results — first product card
    const priceSelectors = [
      '.s-result-item .a-price .a-offscreen',
      '[data-component-type="s-search-result"] .a-price .a-offscreen',
      '.a-price .a-offscreen',
    ];
    const linkSelectors = [
      '.s-result-item h2 a',
      '[data-component-type="s-search-result"] h2 a',
    ];
    const titleSelectors = [
      '.s-result-item h2 span',
      '[data-component-type="s-search-result"] h2 span',
    ];

    const rawPrice = trySelectors(priceSelectors);
    price = parsePrice(rawPrice);

    const link = document.querySelector(linkSelectors.find(s => document.querySelector(s)));
    if (link) {
      productUrl = link.href.startsWith('http') ? link.href : `https://www.amazon.ca${link.getAttribute('href')}`;
    }
    productTitle = trySelectors(titleSelectors);
  }

  if (site === 'walmart') {
    // Walmart search results — first product card
    const priceSelectors = [
      '[data-automation="product-price"]',
      '[data-testid="list-view"] [data-automation="buybox-price"]',
      '.search-result-product-price',
      'span[data-automation="buybox-price"]',
      '[itemprop="price"]',
      '.price-main',
    ];
    const linkSelectors = [
      'a[data-automation="product-title-link"]',
      'a[link-identifier="linkIdentifier"]',
      '.search-result-product-title a',
    ];

    const rawPrice = trySelectors(priceSelectors);
    price = parsePrice(rawPrice);

    const link = document.querySelector(linkSelectors.find(s => document.querySelector(s)));
    if (link) {
      const href = link.getAttribute('href');
      productUrl = href?.startsWith('http') ? href : `https://www.walmart.ca${href}`;
    }
    productTitle = trySelectors([
      'a[data-automation="product-title-link"]',
      '.search-result-product-title',
    ]);
  }

  if (!price || price <= 0 || price > 100000) return null;

  return {
    price,
    url:      productUrl,
    title:    productTitle,
    siteKey:  site,
    siteName: site === 'amazon' ? 'Amazon' : 'Walmart',
  };
}

// ─── MAIN COMPARISON ─────────────────────────────────────────

const OPPOSITE = { amazon: 'walmart', walmart: 'amazon' };

async function runComparison(product) {
  const targetSite = OPPOSITE[product.site];
  if (!targetSite) return []; // unsupported site

  const query     = cleanQuery(product.title);
  const searchUrl = buildSearchUrl(targetSite, query);

  console.log(`[SaveMate] Searching ${targetSite} for: "${query}"`);

  const result = await fetchPriceViaTab(searchUrl, targetSite);
  return result ? [result] : [];
}

// ─── SAVINGS TRACKING ────────────────────────────────────────

async function recordPurchase(product) {
  const { lastComparison } = await chrome.storage.local.get('lastComparison');
  let saved = 0;
  if (lastComparison?.prices?.length > 0) {
    const diff = product.price - lastComparison.prices[0].price;
    if (diff > 0) saved = diff;
  }

  const record = {
    id:          Date.now(),
    title:       product.title,
    pricePaid:   product.price,
    saved,
    site:        product.site,
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

  if (msg.type === 'PRODUCT_DETECTED') {
    const tabId = sender.tab?.id;

    // Immediately store the product with empty prices so popup
    // can show the product name right away while search runs
    const tabKey = tabId ? `tab_${tabId}` : 'tab_unknown';
    const initialRecord = {
      product:    msg.product,
      prices:     [],
      status:     'searching',   // ← popup can show "Searching..."
      timestamp:  Date.now(),
      productUrl: msg.product.url,
    };
    chrome.storage.local.set({ [tabKey]: initialRecord, lastComparison: initialRecord });

    // Now fetch comparison in background
    runComparison(msg.product).then(async prices => {
      const record = { ...initialRecord, prices, status: 'done' };
      await chrome.storage.local.set({ [tabKey]: record, lastComparison: record });

      // Update badge on active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id === tabId && prices.length > 0 && prices[0].price < msg.product.price) {
        const diff = (msg.product.price - prices[0].price).toFixed(0);
        chrome.action.setBadgeText({ text: `$${diff}` });
        chrome.action.setBadgeBackgroundColor({ color: '#00b894' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    });

    return true;
  }

  if (msg.type === 'PURCHASE_CONFIRMED') {
    recordPurchase(msg.product).then(result => sendResponse(result));
    return true;
  }

  if (msg.type === 'CLEAR_COMPARISON') {
    const tabId  = sender.tab?.id;
    const keys   = ['lastComparison'];
    if (tabId) keys.push(`tab_${tabId}`);
    chrome.storage.local.remove(keys);
    chrome.action.setBadgeText({ text: '' });
    return true;
  }

  if (msg.type === 'GET_COMPARISON') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([activeTab]) => {
      if (activeTab?.id) {
        const tabKey  = `tab_${activeTab.id}`;
        const tabData = await chrome.storage.local.get(tabKey);
        if (tabData[tabKey]) { sendResponse(tabData[tabKey]); return; }
      }
      const data = await chrome.storage.local.get('lastComparison');
      sendResponse(data.lastComparison || null);
    });
    return true;
  }

  if (msg.type === 'GET_HISTORY') {
    chrome.storage.local.get('history').then(({ history = [] }) => {
      const totalSaved = history.reduce((sum, r) => sum + (r.saved || 0), 0);
      sendResponse({ history, totalSaved });
    });
    return true;
  }

});