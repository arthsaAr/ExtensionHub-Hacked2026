// ─── shopping.js — SaveMate Section ─────────────────────────
// Exposes initShopping() to the global scope for popup.js router.

function msg(type, data = {}) {
  return new Promise(resolve =>
    chrome.runtime.sendMessage({ type, ...data }, resolve)
  );
}

function $(id) { return document.getElementById(id); }
function fmt(p) { return p != null ? `$${parseFloat(p).toFixed(2)}` : '—'; }

// ─── TOTAL SAVED ─────────────────────────────────────────────

async function renderTotalSaved() {
  const data = await msg('GET_HISTORY');
  $('totalSaved').textContent = fmt(data?.totalSaved ?? 0);
}

// ─── CURRENT PRODUCT NAME ────────────────────────────────────

function renderProductName(product) {
  if (product) {
    $('productName').textContent = product.title;
    const siteNames = { amazon: 'Amazon CA', walmart: 'Walmart CA', bestbuy: 'Best Buy CA', superstore: 'Superstore' };
    const currentSiteName = siteNames[product.site] || product.site;
    $('currentSite').textContent = `Detected on ${currentSiteName}${product.price ? ' · $' + product.price.toFixed(2) : ''}`;
  } else {
    $('productName').textContent = 'Open a product page to start';
    $('currentSite').textContent = 'Tracking Amazon · Walmart · Best Buy · Superstore';
  }
}

// ─── PRICE CARDS ─────────────────────────────────────────────

function renderPriceCards(product, prices, isSearching = false) {
  const container = $('priceCardsContainer');
  container.innerHTML = '';

  if (!product) {
    container.innerHTML = `
      <div class="price-card">
        <div>
          <p class="site">No product detected on this page</p>
          <h3 style="color:#666;font-size:14px">Navigate to a product page on Amazon, Walmart, Best Buy, or Superstore</h3>
        </div>
      </div>`;
    return;
  }

  if (isSearching) {
    container.innerHTML = `
      <div class="price-card" id="sm-searching-card">
        <div style="width:100%;text-align:center;padding:8px 0">
          <p class="site" style="margin-bottom:8px">🔍 Searching Amazon, Walmart, Best Buy, Superstore...</p>
          <div style="height:3px;background:linear-gradient(90deg,#2f6df6,#00b894);border-radius:2px;animation:sm-pulse 1.2s ease-in-out infinite alternate"></div>
        </div>
      </div>`;
    injectPulseStyle();
    return;
  }

  const allSites = buildSitesList(product, prices);
  const validPrices = allSites.map(s => s.price).filter(p => p != null && p > 0);
  const lowestPrice = validPrices.length ? Math.min(...validPrices) : null;

  allSites.forEach(site => {
    console.log("UI card:", site.name, "URL:", site.url);
    const isBest    = lowestPrice != null && site.price != null && site.price === lowestPrice;
    const card      = document.createElement('div');
    card.className  = isBest ? 'price-card best' : 'price-card';

    if (site.url) {
      card.style.cursor = 'pointer';
      card.title        = `Click to open on ${site.name}`;
      card.addEventListener('click', () => chrome.tabs.create({ url: site.url }));
    }

    const priceDisplay = site.price != null
      ? fmt(site.price)
      : (site.isCurrentSite ? 'Current page' : 'No exact match');

    const priceColor = site.price == null
      ? 'color:#666;font-size:13px;font-weight:normal'
      : '';

    let confidenceBadge = '';
    if (!site.isCurrentSite && site.price != null && site.relevanceScore != null) {
      const pct = Math.round(site.relevanceScore * 100);
      const color = pct >= 85 ? '#00b894' : pct >= 70 ? '#f39c12' : '#e74c3c';
      confidenceBadge = `<span style="font-size:10px;color:${color};margin-left:4px">${pct}% match</span>`;
    }

    let savings = '';
    if (!site.isCurrentSite && site.price != null && product.price != null) {
      const diff = product.price - site.price;
      if (diff > 0.01) {
        savings = `<span style="color:#00b894;font-size:11px;font-weight:bold">Save ~${fmt(diff)}</span>`;
      } else if (diff < -0.01) {
        savings = `<span style="color:#e74c3c;font-size:11px">~+${fmt(-diff)} more</span>`;
      } else {
        savings = `<span style="color:#aaa;font-size:11px">Similar price</span>`;
      }
    }

    const noMatchNote = (!site.isCurrentSite && site.price == null)
      ? `<span style="color:#556;font-size:10px;display:block;margin-top:3px">Product not found or filtered as inaccurate</span>`
      : '';

    card.innerHTML = `
      <div style="flex:1;min-width:0">
        <p class="site">
          ${site.name}
          ${site.isCurrentSite ? '<span class="badge" style="background:#555">You\'re here</span>' : ''}
          ${isBest            ? '<span class="badge">Lowest ✓</span>'                              : ''}
          ${confidenceBadge}
        </p>
        <h3 style="${priceColor}">${priceDisplay}</h3>
        ${savings}
        ${noMatchNote}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${site.price != null ? '<span class="stock">In Stock</span>' : ''}
        ${site.url ? `<span style="color:#4c6fff;font-size:11px;font-weight:bold">View →</span>` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

function buildSitesList(product, prices) {
  const ALL_SITES = {
    amazon:     'Amazon CA',
    walmart:    'Walmart CA',
    bestbuy:    'Best Buy CA',
    superstore: 'Superstore',
  };

  const result = [];

  result.push({
    key:           product.site,
    name:          ALL_SITES[product.site] || product.site,
    price:         product.price,
    url:           product.url,
    isCurrentSite: true,
  });

  const otherSites = Object.keys(ALL_SITES).filter(s => s !== product.site);
  for (const siteKey of otherSites) {
    const found = prices.find(p => p.siteKey === siteKey);
    result.push({
      key:            siteKey,
      name:           ALL_SITES[siteKey],
      price:          found?.price          ?? null,
      url:            found?.url            ?? null,
      relevanceScore: found?.relevanceScore ?? null,
      isCurrentSite:  false,
    });
  }

  return result;
}

// ─── POLLING ─────────────────────────────────────────────────

function pollUntilDone(product, attempts = 0) {
  if (attempts > 15) {
    renderPriceCards(product, []);
    return;
  }
  setTimeout(async () => {
    const data = await msg('GET_COMPARISON');
    if (data?.status === 'done') {
      renderProductName(data.product);
      renderPriceCards(data.product, data.prices);
    } else {
      pollUntilDone(data?.product || product, attempts + 1);
    }
  }, 1500);
}

// ─── ANIMATION ───────────────────────────────────────────────

function injectPulseStyle() {
  if (document.getElementById('sm-pulse-style')) return;
  const s = document.createElement('style');
  s.id = 'sm-pulse-style';
  s.textContent = '@keyframes sm-pulse{from{opacity:.2}to{opacity:1}}';
  document.head.appendChild(s);
}

// ─── MAIN LOAD ───────────────────────────────────────────────

async function loadShoppingData() {
  renderTotalSaved();

  const data = await msg('GET_COMPARISON');

  if (!data) {
    renderProductName(null);
    renderPriceCards(null, []);
    return;
  }

  renderProductName(data.product);

  if (data.status === 'searching') {
    renderPriceCards(data.product, [], true);
    pollUntilDone(data.product);
  } else {
    renderPriceCards(data.product, data.prices);
  }
}

// ─── ADD SITE BUTTON ─────────────────────────────────────────

function initShopping() {
  document.getElementById('addSiteBtn').addEventListener('click', () => {
    alert('Add site feature coming soon!');
  });
  loadShoppingData();
}