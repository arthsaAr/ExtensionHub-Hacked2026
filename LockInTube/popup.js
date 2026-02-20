const addBtn = document.getElementById("addTag");
const input = document.getElementById("tagInput");

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