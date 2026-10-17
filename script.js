
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

data.result.split(/\n+/).forEach((line) => {
  const text = line.trim();

  if (!text) return;

  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  resultsMessage.appendChild(paragraph);
});

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
