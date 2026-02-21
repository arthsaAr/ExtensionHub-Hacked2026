function filterVideos() {
  chrome.storage.sync.get(["tags"], (result) => {
    const tags = result.tags || [];
    if (tags.length === 0) return;

    // Function to filter a single video card
    function filterVideoCard(video) {
      const titleElement = video.querySelector(".yt-core-attributed-string");
      const title = titleElement?.textContent?.trim().toLowerCase() || "";
      const matches = tags.some(tag => title.includes(tag));

      if (!matches) {
        video.remove();
      }
    }

    // 1. Filter all currently rendered videos
    const videos = document.querySelectorAll("ytd-rich-item-renderer, ytd-compact-video-renderer");
    videos.forEach(video => filterVideoCard(video));

    // 2️. Observe the DOM for newly added video cards
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Ensure it’s an element node
            if (node.tagName === "YTD-RICH-ITEM-RENDERER" || node.tagName === "YTD-COMPACT-VIDEO-RENDERER") {
              filterVideoCard(node);
            }
            
            // Sometimes YouTube wraps new videos in divs; check children
            node.querySelectorAll && node.querySelectorAll("ytd-rich-item-renderer, ytd-compact-video-renderer").forEach(child => {
              filterVideoCard(child);
            });
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Wait until titles are loaded
function waitForTitles() {
  const videos = document.querySelectorAll("ytd-rich-item-renderer, ytd-compact-video-renderer");
  const anyTitle = Array.from(videos).some(video => video.querySelector(".yt-core-attributed-string")?.textContent?.trim());

  if (!anyTitle) {
    setTimeout(waitForTitles, 500);
    return;
  }

  filterVideos();
}

// Start the script
waitForTitles();

function blockBlacklistedSearch() {
  chrome.storage.sync.get(["blacklist"], (result) => {
    const blacklist = result.blacklist || [];
    console.log("BLACKLISTED TERMS:", blacklist);

    const input = document.querySelector(".ytSearchboxComponentInput");
    if (!input) return;

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        const query = input.value.toLowerCase();

        const isBlocked = blacklist.some(word =>
          query.includes(word.toLowerCase())
        );

        if (isBlocked) {
          event.preventDefault();
          event.stopImmediatePropagation();
          alert("This search term is blocked by your YouTube Filter.");
          input.value = "";
        }
      }
    }, true); // capture phase is important
  });
}

blockBlacklistedSearch();