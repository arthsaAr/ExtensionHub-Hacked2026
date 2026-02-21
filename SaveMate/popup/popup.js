// ============================================================
// SaveMate — popup/popup.js
// Wired to match your friend's exact HTML IDs and classes.
// ============================================================

function msg(type, data = {}) {
  return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve));
}

function $(id) { return document.getElementById(id); }
function fmt(p) { return p != null ? `$${parseFloat(p).toFixed(2)}` : '—'; }

// ─── TABS ────────────────────────────────────────────────────

function setupTabs() {
  $('shoppingTab').addEventListener('click', () => {
    $('shoppingTab').className          = 'tab active';
    $('youtubeTab').className           = 'tab inactive';
    $('shoppingSection').style.display  = 'block';
    $('youtubeSection').style.display   = 'none';
    loadShoppingData();
  });

  $('youtubeTab').addEventListener('click', () => {
    $('youtubeTab').className           = 'tab active';
    $('shoppingTab').className          = 'tab inactive';
    $('youtubeSection').style.display   = 'block';
    $('shoppingSection').style.display  = 'none';
  });
}

// ─── TOTAL SAVED ─────────────────────────────────────────────

async function renderTotalSaved() {
  const data = await msg('GET_HISTORY');
  $('totalSaved').textContent = fmt(data?.totalSaved ?? 0);
}

// ─── CURRENT PRODUCT NAME ────────────────────────────────────

function renderProductName(product) {
  $('productName').textContent = product
    ? product.title
    : 'Open a product page to start';
}

// ─── PRICE CARDS ─────────────────────────────────────────────
// Clears existing cards and injects real ones from backend data.

function renderPriceCards(product, prices) {
  // Remove placeholder + any previously injected cards
  document.querySelectorAll('.price-card').forEach(el => el.remove());

  // The "Prices" section-title is the anchor point
  const priceTitle = [...document.querySelectorAll('.section-title')]
    .find(el => el.textContent.trim() === 'Prices');

  if (!priceTitle) return;

  if (!product) {
    const empty = document.createElement('div');
    empty.className = 'price-card';
    empty.innerHTML = `<div><p class="site">No product detected on this page</p><h3>—</h3></div>`;
    priceTitle.insertAdjacentElement('afterend', empty);
    return;
  }

  // Build unified list: current site + the 2 comparison results
  const allSites = buildSitesList(product, prices);
  const validPrices = allSites.map(s => s.price).filter(p => p != null);
  const lowestPrice = validPrices.length ? Math.min(...validPrices) : null;

  // Insert in reverse so order comes out correct (insertAdjacentElement afterend reverses)
  [...allSites].reverse().forEach(site => {
    const isBest     = lowestPrice != null && site.price === lowestPrice;
    const isClickable = !!site.url;
    const card        = document.createElement('div');
    card.className    = isBest ? 'price-card best' : 'price-card';

    // Make whole card clickable if we have a URL
    if (isClickable) {
      card.style.cursor = 'pointer';
      card.title        = 'Click to open this product';
      card.addEventListener('click', () => {
        chrome.tabs.create({ url: site.url });
      });
    }

    card.innerHTML = `
      <div>
        <p class="site">
          ${site.name}
          ${isBest ? '<span class="badge">Lowest</span>' : ''}
        </p>
        <h3 style="${site.price == null ? 'color:#666;font-size:14px' : ''}">${site.price != null ? fmt(site.price) : 'Not found'}</h3>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        ${site.price != null ? '<span class="stock">In Stock</span>' : ''}
        ${isClickable ? `<span style="color:#4c6fff;font-size:11px;font-weight:bold">View →</span>` : ''}
      </div>
    `;

    priceTitle.insertAdjacentElement('afterend', card);
  });
}

/**
 * Builds the comparison list — EXCLUDES the current site,
 * only shows the other 3 with fetched prices.
 * If a site had no result, it shows as "Not found".
 */
function buildSitesList(product, prices) {
  const nameMap = {
    amazon:     'Amazon',
    walmart:    'Walmart',
    bestbuy:    'Best Buy',
    superstore: 'Superstore',
  };

  // Comparison results from background.js (already excludes current site)
  const result = prices.map(p => ({
    key:   p.siteKey,
    name:  p.siteName,
    price: p.price,
    url:   p.url,
  }));

  // If the opposite site had no result, show it as "Not found"
  const opposite = product.site === 'amazon' ? 'walmart' : 'amazon';
  if (!result.find(r => r.key === opposite)) {
    result.push({ key: opposite, name: nameMap[opposite], price: null, url: null });
  }

  return result;
}

// ─── TAGS ────────────────────────────────────────────────────

function renderTags() {
  $('tagsContainer').innerHTML = ['Amazon', 'Walmart']
    .map(t => `<span class="tag">${t}</span>`)
    .join('');
}

// ─── ADD SITE (your feature, coming later) ───────────────────

function setupAddSite() {
  $('addSiteBtn').addEventListener('click', () => {
    const val = $('newSite').value.trim();
    if (!val) return;
    alert('Custom site tracking coming soon!');
    $('newSite').value = '';
  });
}

// ─── MAIN LOAD ───────────────────────────────────────────────

async function loadShoppingData() {
  renderTotalSaved();
  renderTags();

  const data = await msg('GET_COMPARISON');

  if (!data) {
    renderProductName(null);
    renderPriceCards(null, []);
    return;
  }

  renderProductName(data.product);

  // Still searching — show spinner and poll until done
  if (data.status === 'searching') {
    renderSearchingState();
    pollUntilDone();
    return;
  }

  renderPriceCards(data.product, data.prices);
}

// Shows a "Searching..." card while background tab fetches prices
function renderSearchingState() {
  document.querySelectorAll('.price-card').forEach(el => el.remove());
  const priceTitle = [...document.querySelectorAll('.section-title')]
    .find(el => el.textContent.trim() === 'Prices');
  if (!priceTitle) return;

  const card = document.createElement('div');
  card.className = 'price-card';
  card.id = 'sm-searching-card';
  card.innerHTML = `
    <div style="width:100%;text-align:center;padding:4px 0">
      <p class="site" style="margin-bottom:8px">🔍 Searching other sites...</p>
      <div style="height:3px;background:linear-gradient(90deg,#2f6df6,#00b894);border-radius:2px;animation:sm-pulse 1.2s ease-in-out infinite alternate"></div>
    </div>
  `;
  if (!document.getElementById('sm-pulse-style')) {
    const s = document.createElement('style');
    s.id = 'sm-pulse-style';
    s.textContent = '@keyframes sm-pulse{from{opacity:.2}to{opacity:1}}';
    document.head.appendChild(s);
  }
  priceTitle.insertAdjacentElement('afterend', card);
}

// Poll every 1.5s until background finishes fetching
function pollUntilDone(attempts = 0) {
  if (attempts > 12) return; // give up after ~18 seconds
  setTimeout(async () => {
    const data = await msg('GET_COMPARISON');
    if (data?.status === 'done') {
      renderPriceCards(data.product, data.prices);
    } else {
      pollUntilDone(attempts + 1);
    }
  }, 1500);
}

// ─── INIT ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupAddSite();
  loadShoppingData();
});