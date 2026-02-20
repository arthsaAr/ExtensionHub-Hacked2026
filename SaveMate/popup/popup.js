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
    const isBest = lowestPrice != null && site.price === lowestPrice;
    const card   = document.createElement('div');
    card.className = isBest ? 'price-card best' : 'price-card';

    card.innerHTML = `
      <div>
        <p class="site">
          ${site.name}
          ${isBest ? '<span class="badge">Lowest</span>' : ''}
        </p>
        <h3>${fmt(site.price)}</h3>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        <span class="stock">${site.price != null ? 'In Stock' : 'N/A'}</span>
        ${site.url && site.url !== '#'
          ? `<a href="${site.url}" target="_blank"
               style="color:#4c6fff;font-size:11px;text-decoration:none;font-weight:bold">
               View →
             </a>`
          : ''}
      </div>
    `;

    priceTitle.insertAdjacentElement('afterend', card);
  });
}

/**
 * Merges the current page's product with comparison results
 * into a clean list of all 3 sites, always showing all 3.
 */
function buildSitesList(product, prices) {
  const nameMap = { amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy' };

  // Current site first
  const result = [{
    key:   product.site,
    name:  nameMap[product.site] || product.site,
    price: product.price,
    url:   product.url,
  }];

  // Add comparison fetched prices
  prices.forEach(p => {
    result.push({
      key:   p.siteKey,
      name:  p.siteName,
      price: p.price,
      url:   p.url,
    });
  });

  // Always show all 3 — fill missing as N/A
  ['amazon', 'walmart', 'bestbuy'].forEach(key => {
    if (!result.find(r => r.key === key)) {
      result.push({ key, name: nameMap[key], price: null, url: '#' });
    }
  });

  return result;
}

// ─── TAGS ────────────────────────────────────────────────────

function renderTags() {
  $('tagsContainer').innerHTML = ['Amazon', 'Walmart', 'Best Buy']
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
  renderPriceCards(data.product, data.prices);
}

// ─── INIT ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupAddSite();
  loadShoppingData();
});
