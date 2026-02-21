// These are tech/electronics brands — always include in search query
const TECH_BRANDS = new Set([
  'apple', 'samsung', 'sony', 'lg', 'google', 'microsoft',
  'bose', 'jbl', 'anker', 'sennheiser', 'jabra', 'beats', 'skullcandy', 'marshall',
  'dell', 'hp', 'lenovo', 'asus', 'acer', 'razer', 'msi', 'alienware',
  'logitech', 'corsair', 'steelseries', 'hyperx',
  'fitbit', 'garmin', 'polar',
  'dyson', 'philips', 'braun',
  'breville', 'keurig', 'nespresso', 'ninja', 'cuisinart', 'kitchenaid', 'instant',
  'roomba', 'irobot', 'shark', 'bissell', 'hoover', 'eureka',
  'canon', 'nikon', 'fujifilm', 'gopro', 'dji',
]);

// Apple product names that appear WITHOUT the word "apple"
const APPLE_PRODUCTS = new Set([
  'iphone', 'ipad', 'macbook', 'imac', 'macmini', 'airpods', 'homepod', 'applewatch',
]);

// Non-tech named brands — still keep in query for product specificity
const NAMED_BRANDS = new Set([
  'vileda', 'swiffer', 'rubbermaid', 'oxo', 'stanley', 'yeti', 'hydro',
  'clorox', 'lysol', 'bounty', 'charmin', 'glad', 'hefty', 'ziploc',
  'adidas', 'nike', 'reebok', 'puma', 'lego', 'hasbro', 'mattel',
  'pyrex', 'thermos', 'nalgene', 'contigo',
]);

function detectBrand(title) {
  const lower = title.toLowerCase();
  // Check Apple product names (iphone, ipad, etc.) → treated as Apple tech
  for (const ap of APPLE_PRODUCTS) {
    if (new RegExp(`\\b${ap}\\b`, 'i').test(lower)) {
      return { brand: 'apple', productAlias: ap, isTech: true };
    }
  }
  for (const b of TECH_BRANDS) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(lower)) return { brand: b, isTech: true };
  }
  for (const b of NAMED_BRANDS) {
    if (new RegExp(`\\b${b.replace('.', '\\.')}\\b`, 'i').test(lower)) return { brand: b, isTech: false };
  }
  return null;
}

// ─── GROCERY DETECTION (Superstore only sells groceries+basics) ─

const GROCERY_WORDS = new Set([
  'apple', 'apples', 'orange', 'oranges', 'banana', 'bananas', 'grape', 'grapes',
  'onion', 'onions', 'potato', 'potatoes', 'tomato', 'tomatoes', 'garlic', 'lettuce',
  'carrot', 'carrots', 'broccoli', 'spinach', 'kale', 'celery', 'cucumber',
  'chicken', 'beef', 'pork', 'salmon', 'tuna', 'shrimp', 'turkey', 'lamb',
  'milk', 'cheese', 'butter', 'yogurt', 'cream', 'eggs',
  'bread', 'bagel', 'muffin', 'cereal', 'oats', 'granola', 'flour', 'rice', 'pasta',
  'juice', 'water', 'soda', 'coffee', 'tea',
  'soap', 'shampoo', 'conditioner', 'detergent', 'bleach', 'paper', 'towel', 'tissue',
  'diapers', 'wipes', 'formula',
]);

function isGroceryProduct(title) {
  const words = title.toLowerCase().split(/\s+/);
  return words.some(w => GROCERY_WORDS.has(w));
}

// ─── QUERY BUILDER ───────────────────────────────────────────

const NOISE_WORDS = new Set([
  'with', 'the', 'a', 'an', 'and', 'or', 'for', 'in', 'on', 'of', 'by', 'to', 'from',
  'at', 'this', 'that', 'is', 'are', 'was', 'be', 'has', 'have', 'new', 'ea', 'each',
  'pk', 'item', 'product', 'combo', 'canadian', 'canada', 'ca', 'class',
  'quick', 'fast', 'lot', 'bulk', 'use', 'plus', 'select', 'buy', 'get',
  'pack', 'bundle', 'value', 'only', 'free', 'shipping', 'piece', 'pieces',
]);

const COLOUR_WORDS = new Set([
  'black', 'white', 'silver', 'gold', 'blue', 'red', 'green', 'pink',
  'yellow', 'orange', 'purple', 'grey', 'gray', 'midnight', 'starlight',
  'natural', 'graphite', 'space', 'jet', 'rose', 'coral', 'sage',
  'storm', 'desert', 'sand', 'khaki', 'slate', 'sky', 'deep', 'matte',
]);

const MATERIAL_WORDS = new Set([
  'aluminium', 'aluminum', 'stainless', 'steel', 'titanium', 'ceramic',
  'leather', 'nylon', 'fabric', 'rubber', 'silicone', 'carbon', 'alloy', 'glass',
]);

// Product category words — helps query be specific
const PRODUCT_TYPES = new Set([
  'watch', 'smartwatch', 'phone', 'smartphone', 'laptop', 'notebook',
  'tablet', 'ipad', 'earbuds', 'headphones', 'headset', 'speaker', 'soundbar',
  'camera', 'tv', 'television', 'monitor', 'printer', 'scanner', 'projector',
  'fryer', 'blender', 'mixer', 'vacuum', 'mop', 'kettle', 'toaster',
  'microwave', 'router', 'console', 'gamepad', 'controller',
  'refrigerator', 'fridge', 'washer', 'dryer', 'dishwasher', 'oven', 'stove',
]);

// Patterns that extract model numbers/identifiers
// Order matters — more specific patterns first
const MODEL_PATTERNS = [
  { rx: /\biphone\s+(\d+\w*)/i,                    desc: 'iPhone N'          },
  { rx: /\bipad\s+(?:pro\s+|mini\s+|air\s+)?(\d+)/i, desc: 'iPad N'         },
  { rx: /\bseries\s+(\d+\w*)/i,                    desc: 'Series N'          },
  { rx: /\bgalaxy\s+([a-z]\d+\w*)/i,               desc: 'Galaxy SXX'        },
  { rx: /\bpixel\s+(\d+\w*)/i,                     desc: 'Pixel N'           },
  { rx: /\bgen(?:eration)?\s+(\d+)/i,              desc: 'Gen N'             },
  { rx: /\bmodel\s+(\w+)/i,                        desc: 'Model X'           },
  { rx: /\b([A-Z]{1,4}[-]?\d{3,6}[A-Z0-9]{0,5})\b/, desc: 'Alphanumeric model' },
];

// When these words immediately follow the brand, they ARE the product model name
// e.g. "Vileda EasyWring" — EasyWring is the model
// e.g. "Ninja AF101" — AF101 is the model
const MODEL_AFTER_BRAND_RX = /\b[A-Z][a-zA-Z]{3,}[A-Z0-9]?\b|\b[A-Z]{2,}[0-9]+\w*\b/;

function buildSearchQuery(title) {
  if (!title) return '';
  const brandInfo = detectBrand(title);
  return brandInfo
    ? buildBrandedQuery(title, brandInfo)
    : buildGenericQuery(title);
}

function buildBrandedQuery(title, brandInfo) {
  const { brand, productAlias } = brandInfo;
  const lower = title.toLowerCase();
  const tokens = [];

  // 1. Brand name (always first)
  tokens.push(brand.charAt(0).toUpperCase() + brand.slice(1));

  // 2. If Apple product alias (iphone, ipad, etc.) and brand is 'apple', use alias as product type
  if (productAlias) {
    tokens.push(productAlias);
  } else {
    // Find product type word in title
    const words = lower.split(/[\s\-\/&+,.()\[\]|]+/).filter(Boolean);
    for (const w of words) {
      if (PRODUCT_TYPES.has(w)) { tokens.push(w); break; }
    }
  }

  // 3. Model word that directly follows the brand name in the title
  //    e.g. "Vileda EasyWring" → "EasyWring", "Ninja AF101" → "AF101"
  const brandRx = new RegExp(`\\b${brand}\\s+([\\w\\-]+)`, 'i');
  const brandFollowMatch = title.match(brandRx);
  if (brandFollowMatch) {
    const nextWord = brandFollowMatch[1];
    // Keep if it looks like a model name (CamelCase, alphanumeric code, or all-caps)
    // Skip if it's a plain product type word (watch, mop, etc.) or noise
    const nextLow = nextWord.toLowerCase();
    if (!PRODUCT_TYPES.has(nextLow) && !NOISE_WORDS.has(nextLow) && !COLOUR_WORDS.has(nextLow)) {
      if (MODEL_AFTER_BRAND_RX.test(nextWord) || /\d/.test(nextWord)) {
        if (!tokens.map(t => t.toLowerCase()).includes(nextLow)) {
          tokens.push(nextWord);
        }
      }
    }
  }

  // 4. Extract model numbers from standard patterns (Series 11, Galaxy S25, etc.)
  for (const { rx } of MODEL_PATTERNS) {
    const m = title.match(rx);
    if (m) {
      const modelStr = (m[1] || m[0]).trim();
      // Skip if it's just a number that's already part of a spec (46mm, 256GB)
      // and skip if it's longer than 12 chars (probably not a model)
      if (modelStr.length <= 12 && !tokens.map(t => t.toLowerCase()).includes(modelStr.toLowerCase())) {
        tokens.push(modelStr.toLowerCase());
      }
    }
  }

  // 5. Key specs: storage size, physical size, connectivity
  const specPatterns = [
    { rx: /\b(\d+)\s*(gb|tb)\b/i,          pick: m => m[0].replace(/\s+/g, '').toLowerCase() }, // 256GB
    { rx: /\b(\d+(?:\.\d+)?)\s*mm\b/i,     pick: m => m[0].replace(/\s+/g, '').toLowerCase() }, // 46mm
    { rx: /\b(\d+(?:\.\d+)?)\s*inch\b/i,   pick: m => m[1] + 'in'                             }, // 65 inch → 65in
    { rx: /\b(gps)\b/i,                     pick: _ => 'gps'                                   },
    { rx: /\b(5g)\b/i,                      pick: _ => '5g'                                    },
    { rx: /\b(cellular)\b/i,                pick: _ => 'cellular'                              },
    { rx: /\b(wifi|wi-fi)\b/i,              pick: _ => 'wifi'                                  },
  ];

  let specCount = 0;
  for (const { rx, pick } of specPatterns) {
    const m = title.match(rx);
    if (m && specCount < 2) {
      const spec = pick(m);
      if (spec && !tokens.map(t => t.toLowerCase()).includes(spec)) {
        tokens.push(spec);
        specCount++;
      }
    }
  }

  // 6. For non-tech named brands (Vileda, etc.): add up to 2 descriptive product words
  //    from the title to help the search be specific
  if (!brandInfo.isTech) {
    const words = title.split(/[\s\-\/&+,.()\[\]|]+/).filter(Boolean);
    let added = 0;
    for (const w of words) {
      if (added >= 2) break;
      const wl = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!wl || wl.length < 3) continue;
      if (NOISE_WORDS.has(wl) || COLOUR_WORDS.has(wl) || MATERIAL_WORDS.has(wl)) continue;
      if (tokens.map(t => t.toLowerCase()).includes(wl)) continue;
      if (!/^[a-z]/.test(wl)) continue; // Skip tokens starting with uppercase (handled above)
      tokens.push(wl);
      added++;
    }
  }

  const query = [...new Set(tokens)].slice(0, 6).join(' ');
  console.log(`[SaveMate] Branded query: "${title.substring(0, 55)}" → "${query}"`);
  return query;
}

function buildGenericQuery(title) {
  const tokens = title
    .split(/[\s\-\/&+,.()\[\]|]+/)
    .filter(Boolean)
    .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(t => {
      if (t.length < 3) return false;
      if (NOISE_WORDS.has(t)) return false;
      if (COLOUR_WORDS.has(t)) return false;
      if (MATERIAL_WORDS.has(t)) return false;
      return true;
    });

  const query = [...new Set(tokens)].slice(0, 6).join(' ');
  console.log(`[SaveMate] Generic query: "${title.substring(0, 55)}" → "${query}"`);
  return query;
}

// Uses PHRASES and PATTERNS — not a simple word blocklist.
// This correctly handles "Apple Watch...Sport Band" (not an accessory)
// while blocking "Leather Band compatible with Apple Watch" (accessory).

const ACCESSORY_PHRASES = [
  'compatible with',
  'replacement for',
  'replacement head',
  'designed for',
  'works with',
  'fits for',
  'screen protector',
  'tempered glass',
  'privacy screen',
  'mop head refill',
  'mop refill',
  'filter replacement',
  'vacuum bag',
  'dust bag',
];

const FOR_BRAND_PATTERN = /\bfor\s+(apple|samsung|sony|lg|google|iphone|ipad|galaxy|pixel|airpods|macbook|huawei|xiaomi|oneplus)\b/i;

function isAccessory(title) {
  if (!title) return false;
  const lower = title.toLowerCase();

  for (const phrase of ACCESSORY_PHRASES) {
    if (lower.includes(phrase)) {
      console.log(`[SaveMate] Accessory-phrase "${phrase}": "${title.substring(0, 55)}"`);
      return true;
    }
  }

  if (FOR_BRAND_PATTERN.test(lower)) {
    console.log(`[SaveMate] Accessory-for-brand: "${title.substring(0, 55)}"`);
    return true;
  }

  // Charging/cable accessories
  if (/\b(charger|charging cable|usb.?c cable|lightning cable|magsafe cable)\b/i.test(lower)) {
    console.log(`[SaveMate] Accessory-charger: "${title.substring(0, 55)}"`);
    return true;
  }

  return false;
}

// ─── RELEVANCE SCORER ─────────────────────────────────────────

const MIN_RELEVANCE_SCORE = 0.55;

function normalizeStr(s) {
  return s.toLowerCase()
    .replace(/non-stick/g, 'nonstick')
    .replace(/non stick/g, 'nonstick')
    .replace(/wi-fi/g, 'wifi')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stem(w) {
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ers') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('er')  && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es')  && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s')   && w.length > 3) return w.slice(0, -1);
  return w;
}

function scoreRelevance(searchQuery, resultTitle) {
  if (!searchQuery || !resultTitle) return 0;

  // Hard reject accessories first
  if (isAccessory(resultTitle)) return 0;

  const qNorm  = normalizeStr(searchQuery);
  const rNorm  = normalizeStr(resultTitle);
  const rWords = rNorm.split(' ');
  const rStems = new Set(rWords.map(stem));

  const qWords = qNorm.split(' ').filter(w => w.length >= 2 && !NOISE_WORDS.has(w));
  if (!qWords.length) return 0.5;

  // Brand must be present in result
  const brandInfo = detectBrand(searchQuery);
  if (brandInfo) {
    const brandRx = new RegExp(`\\b${brandInfo.brand}\\b`, 'i');
    if (!brandRx.test(rNorm)) {
      console.log(`[SaveMate] Brand-reject ("${brandInfo.brand}" missing): "${resultTitle.substring(0, 55)}"`);
      return 0;
    }
  }

  // Score: fraction of query words found in result (stem-aware)
  const matches = qWords.filter(w => {
    return rStems.has(stem(w)) || rStems.has(w) || rNorm.includes(w);
  });
  const score = matches.length / qWords.length;

  // First query word (brand or core noun) MUST appear in result
  if (!rNorm.includes(qWords[0]) && !rStems.has(stem(qWords[0]))) {
    console.log(`[SaveMate] Core-reject ("${qWords[0]}"): "${resultTitle.substring(0, 55)}"`);
    return 0;
  }

  console.log(`[SaveMate] Score ${(score * 100).toFixed(0)}% | Q:"${searchQuery}" | R:"${resultTitle.substring(0, 45)}"`);
  return score;
}

async function runComparison(product) {
  const query = buildSearchQuery(product.title);
  if (!query) return [];

  console.log(`[SaveMate] Searching: "${query}" for "${product.title}"`);
  const serpResults = await searchSerpAPI(query, product.title);

  if (!serpResults.length) {
    console.log('[SaveMate] No relevant SerpAPI results');
    return [];
  }

  console.log(`[SaveMate] Found ${serpResults.length} relevant results`);
  return serpResults; // each result has best url
}

// ─── SAVINGS TRACKING ────────────────────────────────────────

async function recordPurchase(product) {
  const { lastComparison } = await chrome.storage.local.get('lastComparison');
  let saved = 0;
  if (lastComparison?.prices?.length && product.price) {
    const others = lastComparison.prices
      .filter(p => p.siteKey !== product.site) // exclude the current site
      .map(p => p.price)
      .filter(Boolean);

    if (others.length) {
      const diff = product.price - Math.min(...others);
      if (diff > 0) saved = diff;
    }
  }
  const record = { id: Date.now(), title: product.title, pricePaid: product.price, saved, site: product.site, purchasedAt: Date.now() };
  const { history = [] } = await chrome.storage.local.get('history');
  history.unshift(record);
  if (history.length > 50) history.length = 50;
  await chrome.storage.local.set({ history });
  return { saved, record };
}

// ─── TAB STATE MANAGEMENT ─────────────────────────────────────

const SHOPPING_HOSTS = ['amazon.ca', 'amazon.com', 'walmart.ca', 'bestbuy.ca', 'realcanadiansuperstore.ca', 'superstore.ca'];

function isShoppingUrl(url) {
  if (!url) return false;
  try { return SHOPPING_HOSTS.some(h => new URL(url).hostname.includes(h)); } catch (_) { return false; }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isShoppingUrl(tab.url)) {
      await chrome.storage.local.remove('lastComparison');
      // chrome.action.setBadgeText({ text: '' });
    } else {
      const key  = `tab_${tabId}`;
      const data = await chrome.storage.local.get(key);
      if (data[key]) {
        await chrome.storage.local.set({ lastComparison: data[key] });
        const r = data[key];
        if (r.prices?.length && r.product?.price) {
          const lowest = Math.min(...r.prices.map(p => p.price).filter(Boolean));
          if (lowest < r.product.price) {
            // chrome.action.setBadgeText({ text: `$${(r.product.price - lowest).toFixed(0)}`, tabId });
            // chrome.action.setBadgeBackgroundColor({ color: '#00b894', tabId });
          }
        }
      } else {
        await chrome.storage.local.remove('lastComparison');
        // chrome.action.setBadgeText({ text: '', tabId });
      }
    }
  } catch (_) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;
  if (!isShoppingUrl(tab.url)) {
    const key = `tab_${tabId}`;
    const ex  = await chrome.storage.local.get(key);
    if (ex[key]) {
      await chrome.storage.local.remove(key);
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active?.id === tabId) {
        await chrome.storage.local.remove('lastComparison');
        // chrome.action.setBadgeText({ text: '', tabId });
      }
    }
  }
});

// ─── MESSAGE HANDLER ─────────────────────────────────────────
 
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'PRODUCT_DETECTED') {
    const tabId  = sender.tab?.id;
    if (!tabId) return true;
    const tabKey = `tab_${tabId}`;

    (async () => {
      try {
        const stored   = await chrome.storage.local.get(tabKey);
        const existing = stored[tabKey];

        if (existing && existing.product?.title === msg.product.title && existing.status === 'done') {
          console.log('[SaveMate] Cache hit:', msg.product.title);
          await chrome.storage.local.set({ lastComparison: existing });
          sendResponse(existing);
          return;
        }

        const init = { product: msg.product, prices: [], status: 'searching', timestamp: Date.now(), productUrl: msg.product.url };
        await chrome.storage.local.set({ [tabKey]: init, lastComparison: init });

        const prices = await runComparison(msg.product);
        const record = { ...init, prices, status: 'done' };
        await chrome.storage.local.set({ [tabKey]: record, lastComparison: record });

        // if (msg.product.price && prices.length) {
        //   const lowest = Math.min(...prices.map(p => p.price).filter(Boolean));
        //   if (lowest < msg.product.price) {
        //     chrome.action.setBadgeText({ text: `$${(msg.product.price - lowest).toFixed(0)}`, tabId });
        //     chrome.action.setBadgeBackgroundColor({ color: '#00b894', tabId });
        //   } else {
        //     chrome.action.setBadgeText({ text: '', tabId });
        //   }
        // }

        sendResponse(record);
      } catch (err) {
        console.error('[SaveMate] PRODUCT_DETECTED failed:', err);
        const failed = { product: msg.product, prices: [], status: 'done' };
        await chrome.storage.local.set({ [tabKey]: failed, lastComparison: failed });
        sendResponse(failed);
      }
    })();

    return true; // ← must be synchronous so Chrome keeps channel open
  }

  if (msg.type === 'PURCHASE_CONFIRMED') {
    recordPurchase(msg.product).then(sendResponse);
    return true;
  }

  if (msg.type === 'CLEAR_COMPARISON') {
    const tabId = sender.tab?.id;
    const keys  = ['lastComparison'];
    if (tabId) { keys.push(`tab_${tabId}`); 
    // chrome.action.setBadgeText({ text: '', tabId }); 
  }
    chrome.storage.local.remove(keys);
    return true;
  }

  if (msg.type === 'GET_COMPARISON') {
    (async () => {
      const tabs   = await chrome.tabs.query({ currentWindow: true });
      const sorted = tabs.slice().sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
      for (const tab of sorted) {
        if (!isShoppingUrl(tab.url)) continue;
        const key  = `tab_${tab.id}`;
        const data = await chrome.storage.local.get(key);
        if (data[key]?.product) { sendResponse(data[key]); return; }
      }
      const data = await chrome.storage.local.get('lastComparison');
      sendResponse(data.lastComparison || null);
    })();
    return true; // ← critical
  }

  if (msg.type === 'GET_HISTORY') {
    chrome.storage.local.get('history').then(({ history = [] }) => {
      sendResponse({ history, totalSaved: history.reduce((s, r) => s + (r.saved || 0), 0) });
    });
    return true;
  }

});

// background.js
// async function searchSerpAPI(query) {
//   const apiKey = 'ac477310b2fa9590006ea7b90126f449b42fb077486144ec8135111890ef4089';
//   const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=ca&hl=en&api_key=${apiKey}`;

//   try {
//     const response = await fetch(url);
//     const data = await response.json();

//     if (!data.shopping_results) return [];

//     return data.shopping_results.map(item => {
//       const price = parseFloat(
//         (item.price || '')
//           .replace(/[^\d.]/g, '')
//       );

//       if(!price || price <= 0){
//         return null;
//       }

//       const source = (item.source || '').toLowerCase();

//       let siteKey = null;
//       if (source.includes('amazon')) siteKey = 'amazon';
//       if (source.includes('walmart')) siteKey = 'walmart';
//       if (source.includes('best buy')) siteKey = 'bestbuy';
//       if (source.includes('superstore')) siteKey = 'superstore';

//       // Only keep results from our four supported stores
//       if (!siteKey) return null;
      
//       return {
//         siteKey,
//         siteName: item.source,
//         price: price,
//         url:
//           item.product_link ||
//           item.link ||
//           item.serpapi_link ||
//           null,
//         title: item.title || '',
//         relevanceScore: 0
//       };
//     }).filter(Boolean);
//   } catch (err) {
//     console.error('[SaveMate] SerpAPI error:', err);
//     return [];
//   }
// }

async function searchSerpAPI(query, originalTitle) {
  const apiKey = 'ac477310b2fa9590006ea7b90126f449b42fb077486144ec8135111890ef4089';
  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=ca&hl=en&api_key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.shopping_results) return [];

    // Map and normalize results
    const results = data.shopping_results.map(item => {
      const price = parseFloat((item.price || '').replace(/[^\d.]/g, ''));
      if (!price || price <= 0) return null;

      const source = (item.source || '').toLowerCase();
      let siteKey = null;
      if (source.includes('amazon')) siteKey = 'amazon';
      if (source.includes('walmart')) siteKey = 'walmart';
      if (source.includes('best buy')) siteKey = 'bestbuy';
      if (source.includes('superstore')) siteKey = 'superstore';
      if (!siteKey) return null;

      return {
        siteKey,
        siteName: item.source,
        price,
        url: item.product_link || item.link || item.serpapi_link || null,
        title: item.title || '',
        relevanceScore: scoreRelevance(originalTitle, item.title || '')
      };
    }).filter(Boolean);

    // Filter only relevant results
    const relevant = results.filter(r => r.relevanceScore >= MIN_RELEVANCE_SCORE);

    // Keep only the best per site (lowest price)
    const bestPerSite = {};
    for (const r of relevant) {
      const existing = bestPerSite[r.siteKey];
      if (!existing || r.price < existing.price) bestPerSite[r.siteKey] = r;
    }

    return Object.values(bestPerSite).sort((a, b) => a.price - b.price);
  } catch (err) {
    console.error('[SaveMate] SerpAPI error:', err);
    return [];
  }
}