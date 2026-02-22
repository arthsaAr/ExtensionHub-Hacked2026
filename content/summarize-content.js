// content.js for summarize tab
console.log("SUMMARIZE IS LOADED!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_PAGE_TEXT") {

    console.log("Got the summarizing request.");

    // Grab the main article if it exists, otherwise full body
    const article = document.querySelector("article");
    const text = article ? article.innerText : document.body.innerText;

    // Clean up whitespace and truncate to avoid token overflow
    const numChars = 10000;
    const cleanedText = text.replace(/\s+/g, " ").trim().slice(0, numChars);

    console.log("The following text will be sent:");
    console.log(cleanedText);

    sendResponse({ text: cleanedText });
  }
});