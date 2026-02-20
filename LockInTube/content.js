function filterVideos() {
  chrome.storage.sync.get(["tags"], (result) => {
    const tags = result.tags || [];
    if (tags.length === 0) return;

    const videos = document.querySelectorAll("ytd-rich-item-renderer");

    videos.forEach(video => {
      const title = video.querySelector("#video-title")?.innerText.toLowerCase();
      const matches = tags.some(tag => title.includes(tag));
      if (!matches) video.remove();
    });
  });
}

const observer = new MutationObserver(filterVideos);
observer.observe(document.body, { childList: true, subtree: true });

filterVideos();