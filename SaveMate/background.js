// ============================================================
// SaveMate — background.js  (v1.1 — API-based search)
//
// WHY NOT HIDDEN TABS?
//   Amazon/Walmart detect automated tabs → CAPTCHA / empty page.
//   This version uses each site's real public search endpoints
//   (the same ones their own search bars use) via fetch().
//   These return JSON or parseable HTML much more reliably.
// ============================================================

// ─── SEARCH QUERY BUILDER ────────────────────────────────────
// Extracts the most meaningful words from a product title.
// Strategy: keep brand (first word), key descriptive words,
// and numeric specs (sizes, counts like "10 inch", "12 piece").

function buildSearchQuery(title) {
  if (!title) return '';

  // Preserve numbers attached to units — they define the product
  // e.g. "12 Piece" "10 Inch" "2L" "500ml"
  const words = title.split(/\s+/).filter(Boolean);

  const stopWords = new Set([
    'with','the','a','an','and','or','for','in','on','of','by',
    'to','from','at','this','that','is','are','was','be',
    'item','product','brand','new','set','piece',
  ]);

  const meaningful = words.filter(w => {
    const lw = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    return lw.length > 1 && !stopWords.has(lw);
  });

  // Take first 6 meaningful words — enough for a good match
  return meaningful.slice(0, 6).join(' ');
}

// ─── SITE SEARCH IMPLEMENTATIONS ─────────────────────────────
// Each function searches one site and returns:
// { price, url, title, siteKey, siteName } or null

// ── WALMART CA ───────────────────────────────────────────────
// Walmart CA has a public search API that returns JSON.

async function searchWalmart(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://www.walmart.ca/api/product-page/search-v2?query=${q}&page=1&lang=en`;

    const res = await fetch(url, {
      headers: {
        'Accept':          'application/json',
        'Accept-Language': 'en-CA,en;q=0.9',
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) throw new Error(`Walmart API ${res.status}`);
    const json = await res.json();

    // The API returns items array
    const items = json?.items?.[0]?.products || json?.products || [];
    if (!items.length) return null;

    // Find first item with a valid price
    for (const item of items) {
      const price = item?.priceObject?.price || item?.prices?.currentPrice?.price || item?.price;
      if (!price || price <= 0) continue;

      const productId   = item?.id || item?.itemId || '';
      const productName = item?.name || item?.title || '';
      const slug        = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const productUrl  = productId
        ? `https://www.walmart.ca/en/ip/${slug}/${productId}`
        : `https://www.walmart.ca/search?q=${encodeURIComponent(query)}`;

      return {
        price:    parseFloat(price),
        url:      productUrl,
        title:    productName,
        siteKey:  'walmart',
        siteName: 'Walmart CA',
      };
    }
    return null;
  } catch (e) {
    console.error('[SaveMate] Walmart search failed:', e.message);
    return null;
  }
}

// ── AMAZON CA ────────────────────────────────────────────────
// Amazon blocks direct API access, but their search results
// page embeds structured JSON data in a <script> tag.
// We fetch the HTML and parse that JSON — no DOM injection needed.

async function searchAmazon(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://www.amazon.ca/s?k=${q}&language=en_CA`;

    const res = await fetch(url, {
      headers: {
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) throw new Error(`Amazon fetch ${res.status}`);
    const html = await res.text();

    // Strategy 1: Parse inline JSON data Amazon embeds
    // Look for price patterns in the raw HTML — Amazon puts
    // prices in multiple locations in the raw HTML source
    const pricePatterns = [
      /"price"\s*:\s*"?\$?([\d,]+\.?\d*)"?/,
      /class="a-price-whole"[^>]*>([\d,]+)</,
      /"displayPrice"\s*:\s*"[^$]*\$([\d,]+\.?\d*)"/,
      /data-a-price="\d+,(\d+)"/,
    ];

    let price = null;
    for (const pat of pricePatterns) {
      const m = html.match(pat);
      if (m) {
        const p = parseFloat(m[1].replace(/,/g, ''));
        if (p > 0 && p < 100000) { price = p; break; }
      }
    }

    // Strategy 2: Find product URL from first search result
    const linkMatch = html.match(/href="(\/[^"]*\/dp\/[A-Z0-9]{10}[^"]*)"/);
    const asin      = linkMatch?.[1]?.match(/\/dp\/([A-Z0-9]{10})/)?.[1];

    // Strategy 3: Find product title near the ASIN
    let productTitle = null;
    if (asin) {
      const titleRx = new RegExp(`"${asin}"[^{]*?"title"\\s*:\\s*"([^"]{10,150})"`, 's');
      const tm      = html.match(titleRx);
      productTitle  = tm?.[1];
    }

    if (!price) {
      // Last resort: look for any "$XX.XX" pattern that looks like a product price
      const allPrices = [...html.matchAll(/\$\s*([\d,]+\.\d{2})/g)]
        .map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(p => p > 1 && p < 100000);
      if (allPrices.length) price = allPrices[0];
    }

    if (!price) return null;

    const productUrl = asin
      ? `https://www.amazon.ca/dp/${asin}`
      : `https://www.amazon.ca/s?k=${q}`;

    return {
      price,
      url:      productUrl,
      title:    productTitle || query,
      siteKey:  'amazon',
      siteName: 'Amazon CA',
    };
  } catch (e) {
    console.error('[SaveMate] Amazon search failed:', e.message);
    return null;
  }
}

// ── BEST BUY CA ──────────────────────────────────────────────
// Best Buy CA has a public search API used by their website.

async function searchBestBuy(query) {
  try {
    const q = encodeURIComponent(query);
    // Best Buy's public search API (used by bestbuy.ca's own search bar)
    const url = `https://www.bestbuy.ca/api/2.0/json/search?query=${q}&lang=en-CA&pageSize=5&sortBy=relevance&categoryId=`;

    const res = await fetch(url, {
      headers: {
        'Accept':          'application/json',
        'Accept-Language': 'en-CA,en;q=0.9',
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer':         'https://www.bestbuy.ca/',
      },
    });

    if (!res.ok) throw new Error(`BestBuy API ${res.status}`);
    const json = await res.json();

    const products = json?.products || [];
    for (const p of products) {
      const price = p?.salePrice || p?.regularPrice;
      if (!price || price <= 0) continue;

      const sku = p?.sku || p?.productId || '';
      const productUrl = sku
        ? `https://www.bestbuy.ca/en-ca/product/${encodeURIComponent(p.name || query).toLowerCase().replace(/%20/g,'-')}/${sku}.aspx`
        : `https://www.bestbuy.ca/en-ca/search?query=${q}`;

      return {
        price:    parseFloat(price),
        url:      productUrl,
        title:    p?.name || query,
        siteKey:  'bestbuy',
        siteName: 'Best Buy CA',
      };
    }
    return null;
  } catch (e) {
    console.error('[SaveMate] Best Buy search failed:', e.message);
    return null;
  }
}

// ── SUPERSTORE CA ────────────────────────────────────────────
// Real Canadian Superstore — primarily groceries/household.
// Uses their public search API.

async function searchSuperstore(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://api.realcanadiansuperstore.ca/v8/products/search?query=${q}&lang=en&storeId=1025&pcId=undefined`;

    const res = await fetch(url, {
      headers: {
        'Accept':          'application/json',
        'Accept-Language': 'en-CA',
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer':         'https://www.realcanadiansuperstore.ca/',
        'x-apikey':        'e4f8d35a-bbf3-4a78-a5f2-a22fd26c8cf7', // Public key used by their site
      },
    });

    if (!res.ok) throw new Error(`Superstore API ${res.status}`);
    const json = await res.json();

    const results = json?.results || json?.products || [];
    for (const item of results) {
      const price = item?.prices?.wasPrice?.value || item?.prices?.price?.value || item?.price;
      if (!price || price <= 0) continue;

      const code = item?.code || '';
      const productUrl = code
        ? `https://www.realcanadiansuperstore.ca/p/${item?.name?.toLowerCase().replace(/[^a-z0-9]+/g,'-')}/${code}`
        : `https://www.realcanadiansuperstore.ca/search?search-bar=${q}`;

      return {
        price:    parseFloat(price),
        url:      productUrl,
        title:    item?.name || query,
        siteKey:  'superstore',
        siteName: 'Superstore',
      };
    }
    return null;
  } catch (e) {
    console.error('[SaveMate] Superstore search failed:', e.message);
    return null;
  }
}

// ─── MAIN COMPARISON ORCHESTRATOR ────────────────────────────
// Given the current product, searches all OTHER sites in parallel.

const SITE_SEARCHERS = {
  amazon:     searchAmazon,
  walmart:    searchWalmart,
  bestbuy:    searchBestBuy,
  superstore: searchSuperstore,
};

async function runComparison(product) {
  const query = buildSearchQuery(product.title);
  if (!query) return [];

  console.log(`[SaveMate] Searching for: "${query}" (from site: ${product.site})`);

  // Search all sites EXCEPT the current one — in parallel
  const otherSites = Object.keys(SITE_SEARCHERS).filter(s => s !== product.site);

  const results = await Promise.allSettled(
    otherSites.map(site => SITE_SEARCHERS[site](query))
  );

  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(Boolean);
}

// ─── SAVINGS TRACKING ────────────────────────────────────────

async function recordPurchase(product) {
  const { lastComparison } = await chrome.storage.local.get('lastComparison');
  let saved = 0;
  if (lastComparison?.prices?.length && product.price) {
    const lowestOther = Math.min(...lastComparison.prices.map(p => p.price).filter(Boolean));
    const diff = product.price - lowestOther;
    if (diff > 0) saved = diff; // User paid more than cheapest alternative
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

  // ── Product detected on a page ──────────────────────────────
  if (msg.type === 'PRODUCT_DETECTED') {
    const tabId  = sender.tab?.id;
    const tabKey = tabId ? `tab_${tabId}` : 'tab_unknown';

    // Store immediately so popup can show product name right away
    const initialRecord = {
      product:    msg.product,
      prices:     [],
      status:     'searching',
      timestamp:  Date.now(),
      productUrl: msg.product.url,
    };
    chrome.storage.local.set({ [tabKey]: initialRecord, lastComparison: initialRecord });

    // Run all comparisons in background (parallel fetches)
    runComparison(msg.product).then(async prices => {
      console.log(`[SaveMate] Found ${prices.length} comparison price(s)`);
      const record = { ...initialRecord, prices, status: 'done' };
      await chrome.storage.local.set({ [tabKey]: record, lastComparison: record });

      // Update badge if cheaper alternative found
      if (msg.product.price && prices.length) {
        const lowest = Math.min(...prices.map(p => p.price));
        if (lowest < msg.product.price) {
          const diff = (msg.product.price - lowest).toFixed(0);
          chrome.action.setBadgeText({ text: `$${diff}`, tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#00b894', tabId });
        } else {
          chrome.action.setBadgeText({ text: '', tabId });
        }
      }
    }).catch(err => {
      console.error('[SaveMate] runComparison error:', err);
      const record = { ...initialRecord, prices: [], status: 'done' };
      chrome.storage.local.set({ [tabKey]: record, lastComparison: record });
    });

    return true;
  }

  // ── User confirmed purchase ─────────────────────────────────
  if (msg.type === 'PURCHASE_CONFIRMED') {
    recordPurchase(msg.product).then(result => sendResponse(result));
    return true;
  }

  // ── Clear comparison when user navigates away ───────────────
  if (msg.type === 'CLEAR_COMPARISON') {
    const tabId = sender.tab?.id;
    const keys  = ['lastComparison'];
    if (tabId) {
      keys.push(`tab_${tabId}`);
      chrome.action.setBadgeText({ text: '', tabId });
    }
    chrome.storage.local.remove(keys);
    return true;
  }

  // ── Popup asks for current comparison data ──────────────────
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

  // ── Popup asks for savings history ─────────────────────────
  if (msg.type === 'GET_HISTORY') {
    chrome.storage.local.get('history').then(({ history = [] }) => {
      const totalSaved = history.reduce((sum, r) => sum + (r.saved || 0), 0);
      sendResponse({ history, totalSaved });
    });
    return true;
  }

});
