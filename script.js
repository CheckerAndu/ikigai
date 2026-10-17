
const form = document.querySelector("#ikigai-form");
const results = document.querySelector("#results");
const resultsMessage = document.querySelector("#results-message");
const editAnswersButton = document.querySelector("#edit-answers");
const findButton = document.querySelector("#find-button");

// Your public Cloudflare Worker URL — never put the API key here.
const API_URL =
  "https://ikigaigeminiapi.andrei-penisoara.workers.dev";

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
  findButton.textContent = "Exploring your Ikigai…";
  results.hidden = false;
  resultsMessage.textContent =
    "Your answers are being analysed. This may take a few seconds.";
  results.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(answers)
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data.error || "The analysis could not be completed."
      );
    }

    if (typeof data.result !== "string" || !data.result.trim()) {
      throw new Error("The AI returned an empty result.");
    }

    // textContent which displays plain text safely
    
resultsMessage.replaceChildren();

const lines = data.result.split(/\r?\n/);
let currentList = null;

for (const rawLine of lines) {
  const line = rawLine.trim();

  if (!line) {
    currentList = null;
    continue;
  }

  // Remove common Markdown heading markers.
  const headingMatch = line.match(/^#{1,3}\s+(.+)$/);

  if (headingMatch) {
    currentList = null;
    const heading = document.createElement("h3");
    heading.textContent = headingMatch[1].replace(/\*+/g, "");
    resultsMessage.appendChild(heading);
    continue;
  }

  // Support bullet points and numbered lists.
  const listMatch = line.match(/^(?:[-*]\s+|\d+[.)]\s+)(.+)$/);

  if (listMatch) {
    const isNumbered = /^\d+[.)]\s+/.test(line);
    const listType = isNumbered ? "ol" : "ul";

    if (!currentList || currentList.tagName.toLowerCase() !== listType) {
      currentList = document.createElement(listType);
      resultsMessage.appendChild(currentList);
    }

    const item = document.createElement("li");
    item.textContent = listMatch[1].replace(/\*+/g, "");
    currentList.appendChild(item);
    continue;
  }

  // Treat short Markdown-style titles as headings
  const cleanedLine = line.replace(/\*+/g, "").trim();

  if (
    cleanedLine.length < 90 &&
    /^(direction|next step|why it fits|summary|recommendation|your ikigai)/i.test(cleanedLine)
  ) {
    currentList = null;
    const heading = document.createElement("h3");
    heading.textContent = cleanedLine;
    resultsMessage.appendChild(heading);
    continue;
  }

  // Ordinary paragraph.
  currentList = null;
  const paragraph = document.createElement("p");
  paragraph.textContent = cleanedLine;
  resultsMessage.appendChild(paragraph);
}

  } catch (error) {
    console.error("Ikigai request failed:", error);
    resultsMessage.textContent =
      "Sorry, we couldn't analyse your answers. Please try again. " +
      "If the problem continues, check the Cloudflare Worker logs.";
  } finally {
    findButton.disabled = false;
    findButton.innerHTML =
      'Explore my Ikigai <span aria-hidden="true">↗</span>';
  }
});

editAnswersButton.addEventListener("click", () => {
  results.hidden = true;
  document.querySelector("#love").focus();
});
