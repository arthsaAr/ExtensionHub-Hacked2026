// ─── popup.js — Section Router (dropdown) ───────────────────
const ALL_SECTIONS = ['shoppingSection', 'youtubeSection', 'summarizeSection'];

const initialised = {
  shoppingSection:  false,
  youtubeSection:   false,
  summarizeSection: false,
};

function switchSection(sectionId) {
  // Hide all, show target
  ALL_SECTIONS.forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById(sectionId).style.display = 'block';

  // Call each section's init() exactly once
  if (!initialised[sectionId]) {
    initialised[sectionId] = true;
    if (sectionId === 'shoppingSection'  && typeof initShopping   === 'function') initShopping();
    if (sectionId === 'youtubeSection'   && typeof initLockInTube === 'function') initLockInTube();
    if (sectionId === 'summarizeSection' && typeof initSummarize  === 'function') initSummarize();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('sectionSelect');

  select.addEventListener('change', () => switchSection(select.value));

  // Boot into Shopping by default
  switchSection('shoppingSection');
});