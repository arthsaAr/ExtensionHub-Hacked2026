const addBtn = document.getElementById("addTag");
const input = document.getElementById("tagInput");
const resetButton = document.getElementById("clearTagsBtn");
const reloadButton = document.getElementById("reloadPage");

const blackListTagInput = document.getElementById("blacklistTagInput");
const blackListAddBtn = document.getElementById("blackListAddTag");

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
  // Clear tags in chrome.storage
  chrome.storage.sync.set({ tags: [] }, () => {
    // Optional: clear the UI list
    const tagList = document.getElementById("tagList");
    tagList.innerHTML = "";
  });
});

reloadButton.addEventListener("click", () => {
  // Reload the current tab (works in Chrome extension)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].id) {
      chrome.tabs.reload(tabs[0].id);
    }
  });
});
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

renderTags();

// Blacklisting
chrome.storage.sync.set({ blacklist: ["gaming", "gta"] });
