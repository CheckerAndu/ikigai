
const form = document.querySelector("#ikigai-form");
const results = document.querySelector("#results");
const resultsMessage = document.querySelector("#results-message");
const editAnswersButton = document.querySelector("#edit-answers");
const findButton = document.querySelector("#find-button");

const API_URL = "https://ikigaigeminiapi.andrei-penisoara.workers.dev";

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const answers = {
    love: form.elements.love.value.trim(),
    good: form.elements.good.value.trim(),
    paid: form.elements.paid.value.trim(),
    world: form.elements.world.value.trim()
  };

  findButton.disabled = true;
  findButton.textContent = "Exploring your Ikigai...";
  results.hidden = false;
  resultsMessage.textContent = "Analysing your answers...";
  results.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers)
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Analysis failed.");
    }

    if (typeof data.result !== "string" || !data.result.trim()) {
      throw new Error("Gemini returned an empty result.");
    }

    // Keep a copy of the full response for debugging.
    console.log("Full Gemini response:", data.result);
    console.log("Response length:", data.result.length);

    resultsMessage.replaceChildren();

    const lines = data.result.split(/\r?\n/);
    let currentList = null;

    for (const rawLine of lines) {
      // Remove common Markdown formatting safely.
      const line = rawLine.trim()
        .replace(/^#{1,3}\s+/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/_(.*?)_/g, "$1");

      if (!line) {
        currentList = null;
        continue;
      }

      // Numbered and bulleted lists.
      const listMatch = line.match(/^(?:[-*]\s+|\d+[.)]\s+)(.+)$/);

      if (listMatch) {
        const numbered = /^\d+[.)]\s+/.test(line);
        const type = numbered ? "ol" : "ul";

        if (!currentList || currentList.tagName.toLowerCase() !== type) {
          currentList = document.createElement(type);
          resultsMessage.appendChild(currentList);
        }

        const item = document.createElement("li");
        item.textContent = listMatch[1];
        currentList.appendChild(item);
        continue;
      }

      currentList = null;

      // Recognise headings even if Gemini uses bold text instead of #.
      const isHeading =
        line.length < 100 &&
        /^(direction\s*\d*|why it fits|next step|small next step|summary|recommendation|your ikigai|possible direction)/i.test(line);

      const element = document.createElement(isHeading ? "h3" : "p");
      element.textContent = line;
      resultsMessage.appendChild(element);
    }

  } catch (error) {
    console.error("Ikigai request failed:", error);
    resultsMessage.textContent =
      "We couldn't complete your analysis. Please try again. " +
      "If the problem continues, check the browser Console and Cloudflare Worker logs.";
  } finally {
    findButton.disabled = false;
    findButton.textContent = "Explore my Ikigai ↗";
  }
});

editAnswersButton.addEventListener("click", () => {
  results.hidden = true;
  document.querySelector("#love").focus();
});
