// popup.js

const summarizeBtn = document.querySelector("#summarizeBtn");
const output = document.querySelector("#summaryOutput");

// Min and Max words
const minWords = document.querySelector("#minWords");
const maxWords = document.querySelector("#maxWords");

// Summarize Functionality
summarizeBtn.addEventListener("click", async () => {
  output.innerHTML = "Summarizing...";

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Ask content script for page text
  chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TEXT" }, async (response) => {
    if (chrome.runtime.lastError) {
    console.error("Message failed:", chrome.runtime.lastError.message);
    output.innerHTML = "Cannot summarize this page.";
    return;
  }

  if (!response?.text) {
    output.innerHTML = "No text extracted.";
    return;
  }

    console.log("Got the text body!");
    console.log(response.text);

    console.log(parseInt(minWords.value));
    console.log(parseInt(maxWords.value));

    const summaryPrompt = `
Summarize the following webpage with minimum words: ${parseInt(minWords.value)} and maximum words: ${parseInt(maxWords.value)}:

${response.text}
`;

    try {
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma3:270m",
          messages: [{ role: "user", content: summaryPrompt }],
          stream: false,
          options: { num_predict: 300 }
        })
      });

      const data = await res.json();
      const modelText = data.message?.content || "No response from model.";

      console.log("Printing the summarized output.");
      console.log(modelText);

      output.innerText = modelText;

    } catch (err) {
      console.error("Ollama fetch error:", err);
      output.innerText = "Error calling Ollama.";
    }
  });
});

// Ask AI Functionality
const askBtn = document.getElementById("askBtn");
const questionInput = document.getElementById("questionInput");

const aiAnswer = document.getElementById("aiAnswer");

askBtn.addEventListener("click", async () => {
  aiAnswer.innerHTML = "Thinking...";

  const question = questionInput.value.trim();
  if (!question) return;

  console.log("Question:");
  console.log(question);

  // Get active tab
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  // Ask content script for page text
  chrome.tabs.sendMessage(
    tab.id,
    { type: "GET_PAGE_TEXT" },
    async (response) => {
      if (chrome.runtime.lastError) {
        console.error("Message failed:", chrome.runtime.lastError);
        return;
      }

      const pageText = response.text;
      console.log("The text that the answer will be based on:");
      console.log(pageText);

      const finalPrompt = `
      You are analyzing the following webpage.

      PAGE CONTENT:
      ${pageText}

      USER QUESTION:
      ${question}

      Answer clearly and concisely.
      `;

      try {
        const res = await fetch("http://localhost:11434/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemma3:270m",
            messages: [{ role: "user", content: finalPrompt }],
            stream: false,
          }),
        });

        const data = await res.json();
        const answer = data.message?.content || "No response";

        aiAnswer.innerText = answer;
        console.log("LLM Answer:", answer);

      } catch (err) {
        console.error("Ollama error:", err);
      }
    }
  );
});