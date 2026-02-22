//sending message to background script and waiting for reply
function msg(type, data = {}) {
  return new Promise(resolve =>
    chrome.runtime.sendMessage({ type, ...data }, resolve)
  );
}

function $(id)  { return document.getElementById(id); }   //document.getElementById
function fmt(p) {                                          //just for price
  if (p != null) {
    return `$${parseFloat(p).toFixed(2)}`;
  } else {
    return '—';
  }
}

//fetches purchase history and updates the total saved in the UI
async function renderTotalSaved() {
  const data = await msg('GET_HISTORY');
  $('totalSaved').textContent = fmt(data?.totalSaved ?? 0);
}

//updates the product title and site name at the top of popup
function renderProductName(product) {
  const SITE_NAMES = { amazon: 'Amazon CA', walmart: 'Walmart CA', bestbuy: 'Best Buy CA', superstore: 'Superstore' };

  if (product) {
    $('productName').textContent = product.title;

    let siteLabel = SITE_NAMES[product.site];
    if (!siteLabel) {
      siteLabel = product.site;
    }

    let priceText = '';
    if (product.price) {
      priceText = ' · $' + product.price.toFixed(2);
    }

    $('currentSite').textContent = `Detected on ${siteLabel}${priceText}`;
  } else {
    $('productName').textContent = 'Open a product page to start';
    $('currentSite').textContent = 'Tracking Amazon · Walmart · Best Buy · Superstore';
  }
}

//returns 85% match kind of colored badge
function getConfidenceBadge(site) {
  if (site.isCurrentSite || site.price == null || site.relevanceScore == null) {
    return '';
  }

  const pct = Math.round(site.relevanceScore * 100);

  let color;
  if (pct >= 85) {
    color = '#00b894';
  } else if (pct >= 70) {
    color = '#f39c12';
  } else {
    color = '#e74c3c';
  }

  return `<span style="font-size:10px;color:${color};margin-left:4px">${pct}% match</span>`;
}

//returns Save ~$X / Similar price / +$X more text
function getSavingsText(site, currentPrice) {
  if (site.isCurrentSite || site.price == null || currentPrice == null) {
    return '';
  }

  const diff = currentPrice - site.price;

  if (diff > 0.01) {
    return `<span style="color:#00b894;font-size:11px;font-weight:bold">Save ~${fmt(diff)}</span>`;
  } else if (diff < -0.01) {
    return `<span style="color:#e74c3c;font-size:11px">~+${fmt(-diff)} more</span>`;
  } else {
    return `<span style="color:#aaa;font-size:11px">Similar price</span>`;
  }
}

//returns the product not found note if the price was not found
function getNoMatchNote(site) {
  if (site.isCurrentSite || site.price != null) {
    return '';
  }

  return `<span style="color:#556;font-size:10px;display:block;margin-top:3px">Product not found or filtered as inaccurate</span>`;
}

//making the price card
function buildCard(site, isBest, currentPrice) {
  console.log("UI card:", site.name, "URL:", site.url);

  const card = document.createElement('div');

  if (isBest) {
    card.className = 'price-card best';
  } else {
    card.className = 'price-card';
  }

  if (site.url) {
    card.style.cursor = 'pointer';
    card.title        = `Click to open on ${site.name}`;
    card.addEventListener('click', () => chrome.tabs.create({ url: site.url }));
  }

  let priceDisplay;
  if (site.price != null) {
    priceDisplay = fmt(site.price);
  } else if (site.isCurrentSite) {
    priceDisplay = 'Current page';
  } else {
    priceDisplay = 'No exact match';
  }

  let priceColor;
  if (site.price == null) {
    priceColor = 'color:#666;font-size:13px;font-weight:normal';
  } else {
    priceColor = '';
  }

  let youAreHereBadge = '';
  if (site.isCurrentSite) {
    youAreHereBadge = '<span class="badge" style="background:#555">You\'re here</span>';
  }

  let lowestBadge = '';
  if (isBest) {
    lowestBadge = '<span class="badge">Lowest ✓</span>';
  }

  let inStockBadge = '';
  if (site.price != null) {
    inStockBadge = '<span class="stock">In Stock</span>';
  }

  let viewArrow = '';
  if (site.url) {
    viewArrow = '<span style="color:#4c6fff;font-size:11px;font-weight:bold">View →</span>';
  }

  card.innerHTML = `
    <div style="flex:1;min-width:0">
      <p class="site">
        ${site.name}
        ${youAreHereBadge}
        ${lowestBadge}
        ${getConfidenceBadge(site)}
      </p>
      <h3 style="${priceColor}">${priceDisplay}</h3>
      ${getSavingsText(site, currentPrice)}
      ${getNoMatchNote(site)}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
      ${inStockBadge}
      ${viewArrow}
    </div>
  `;

  return card;
}

//taking current site product and comparison prices into one clean list
function buildSitesList(product, prices) {
  const ALL_SITES = { amazon: 'Amazon CA', walmart: 'Walmart CA', bestbuy: 'Best Buy CA', superstore: 'Superstore' };

  let siteName = ALL_SITES[product.site];
  if (!siteName) {
    siteName = product.site;
  }

  const result = [{
    key:           product.site,
    name:          siteName,
    price:         product.price,
    url:           product.url,
    isCurrentSite: true,
  }];

  const otherSites = Object.keys(ALL_SITES).filter(s => s !== product.site);

  for (const siteKey of otherSites) {
    const found = prices.find(p => p.siteKey === siteKey);

    let price          = null;
    let url            = null;
    let relevanceScore = null;

    if (found) {
      price          = found.price;
      url            = found.url;
      relevanceScore = found.relevanceScore;
    }

    result.push({
      key:            siteKey,
      name:           ALL_SITES[siteKey],
      price:          price,
      url:            url,
      relevanceScore: relevanceScore,
      isCurrentSite:  false,
    });
  }

  return result;
}

//empty state or loading animation or price cards
function renderPriceCards(product, prices, isSearching = false) {
  const container = $('priceCardsContainer');
  container.innerHTML = '';

  if (!product) {
    container.innerHTML = `
      <div class="price-card"><div>
        <p class="site">No product detected on this page</p>
        <h3 style="color:#666;font-size:14px">Navigate to a product page on Amazon, Walmart, Best Buy, or Superstore</h3>
      </div></div>`;
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

  const allSites    = buildSitesList(product, prices);
  const validPrices = allSites.map(s => s.price).filter(p => p != null && p > 0);

  let lowestPrice = null;
  if (validPrices.length) {
    lowestPrice = Math.min(...validPrices);
  }

  const visibleSites = allSites.filter(site => site.isCurrentSite || site.price != null);

  visibleSites.forEach(site => {
    let isBest = false;
    if (lowestPrice != null && site.price === lowestPrice) {
      isBest = true;
    }
    container.appendChild(buildCard(site, isBest, product.price));
  });
}

//every 1.5s asking if the price search is done
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
      let nextProduct = product;
      if (data?.product) {
        nextProduct = data.product;
      }
      pollUntilDone(nextProduct, attempts + 1);
    }
  }, 1500);
}

//the loading bar css animation
function injectPulseStyle() {
  if (document.getElementById('sm-pulse-style')) {
    return;
  }
  const s = document.createElement('style');
  s.id = 'sm-pulse-style';
  s.textContent = '@keyframes sm-pulse{from{opacity:.2}to{opacity:1}}';
  document.head.appendChild(s);
}

//fetches data and decides what to show: results or start searching
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

//setting up the add site button and kicking everything off
function initShopping() {
  $('addSiteBtn').addEventListener('click', () => {
    alert('Add site feature coming soon!');
  });
  loadShoppingData();
}