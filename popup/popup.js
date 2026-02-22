// ─── popup.js — Section Router with persistent state ────────

const ALL_SECTIONS = ['homeSection', 'shoppingSection', 'youtubeSection', 'summarizeSection'];
const STORAGE_KEY  = 'Hub_active_section';

const initialised = {
  shoppingSection:  false,
  youtubeSection:   false,
  summarizeSection: false,
};

// ── Show/hide sections ────────────────────────────────────────

function showSection(sectionId) {
  ALL_SECTIONS.forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById(sectionId).style.display = 'block';

  const select  = document.getElementById('sectionSelect');
  const homeBtn = document.getElementById('homeBtn');
  const isHome  = sectionId === 'homeSection';

  // Hide both controls on home screen, show on all others
  select.style.visibility  = isHome ? 'hidden' : 'visible';
  homeBtn.classList.toggle('hidden', isHome);

  if (!isHome) select.value = sectionId;
}

// ── Switch + persist + init ───────────────────────────────────

function switchSection(sectionId) {
  showSection(sectionId);

  // Persist choice (not for home screen)
  if (sectionId !== 'homeSection') {
    chrome.storage.local.set({ [STORAGE_KEY]: sectionId });
  }

  // Call each section's init() exactly once on first open
  if (!initialised[sectionId] && sectionId !== 'homeSection') {
    initialised[sectionId] = true;
    if (sectionId === 'shoppingSection'  && typeof initShopping   === 'function') initShopping();
    if (sectionId === 'youtubeSection'   && typeof initLockInTube === 'function') initLockInTube();
    if (sectionId === 'summarizeSection' && typeof initSummarize  === 'function') initSummarize();
  }
}

// ── Boot ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('sectionSelect');

  // Dropdown change → switch + save
  select.addEventListener('change', () => switchSection(select.value));

  // Home button → clear storage and go home
  document.getElementById('homeBtn').addEventListener('click', () => {
    chrome.storage.local.remove(STORAGE_KEY);
    showSection('homeSection');
  });

  // Home screen cards
  document.querySelectorAll('.home-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.section;
      switchSection(target);
    });
  });

  // Restore last used section, or show home if first time
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const saved = result[STORAGE_KEY];
    if (saved) {
      switchSection(saved);
    } else {
      showSection('homeSection');
    }
  });
});