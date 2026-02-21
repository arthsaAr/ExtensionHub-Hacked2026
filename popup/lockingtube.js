// ─── lockingtube.js — LockInTube Section ────────────────────
// Exposes initLockInTube() to the global scope for popup.js router.
// All DOM access is deferred until initLockInTube() is called,
// so elements are guaranteed to exist when this runs.

function initLockInTube() {

  const addBtn       = document.getElementById("addTag");
  const input        = document.getElementById("tagInput");
  const resetButton  = document.getElementById("clearTagsBtn");
  const reloadButton = document.getElementById("reloadPage");

  const blackListTagInput = document.getElementById("blacklistTagInput");
  const blackListAddBtn   = document.getElementById("blackListAddTag");
  const bClearBtn         = document.getElementById("b-clearTagsBtn");
  const bReloadBtn        = document.getElementById("b-reloadPage");

  // ── Allowed tags ────────────────────────────────────────────

  addBtn.addEventListener("click", () => {
    const tag = input.value.trim().toLowerCase();
    if (!tag) return;
    chrome.storage.sync.get(["tags"], (result) => {
      const tags = result.tags || [];
      if (!tags.includes(tag)) tags.push(tag);
      chrome.storage.sync.set({ tags }, () => {
        input.value = "";
        renderTags();
      });
    });
  });

  resetButton.addEventListener("click", () => {
    chrome.storage.sync.set({ tags: [] }, () => {
      document.getElementById("tagList").innerHTML = "";
    });
  });

  reloadButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) chrome.tabs.reload(tabs[0].id);
    });
  });

  // ── Blacklist tags ───────────────────────────────────────────

  blackListAddBtn.addEventListener("click", () => {
    const tag = blackListTagInput.value.trim().toLowerCase();
    if (!tag) return;
    chrome.storage.sync.get(["blacklist"], (result) => {
      const blacklist = result.blacklist || [];
      if (!blacklist.includes(tag)) blacklist.push(tag);
      chrome.storage.sync.set({ blacklist }, () => {
        blackListTagInput.value = "";
        renderBlacklist();
      });
    });
  });

  bClearBtn.addEventListener("click", () => {
    chrome.storage.sync.set({ blacklist: [] }, () => {
      document.getElementById("blacklistTagList").innerHTML = "";
    });
  });

  bReloadBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) chrome.tabs.reload(tabs[0].id);
    });
  });

  // ── Render helpers ───────────────────────────────────────────

  function renderTags() {
    chrome.storage.sync.get(["tags"], (result) => {
      const tags = result.tags || [];
      const tagList = document.getElementById("tagList");
      tagList.innerHTML = "";
      tags.forEach(tag => {
        const li = document.createElement("li");
        li.textContent = tag;
        tagList.appendChild(li);
      });
    });
  }

  function renderBlacklist() {
    chrome.storage.sync.get(["blacklist"], (result) => {
      const blacklist = result.blacklist || [];
      const list = document.getElementById("blacklistTagList");
      list.innerHTML = "";
      blacklist.forEach(tag => {
        const li = document.createElement("li");
        li.textContent = tag;
        list.appendChild(li);
      });
    });
  }

  // ── Initial render ───────────────────────────────────────────
  renderTags();
  renderBlacklist();
}