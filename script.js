const form = document.querySelector("#ikigai-form");
const results = document.querySelector("#results");
const resultsMessage = document.querySelector("#results-message");
const editAnswersButton = document.querySelector("#edit-answers");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  // TODO (your task): collect the four answers into one object.
  // TODO (later): send that object to a secure server endpoint that calls an AI model.
  // Never place a private API key in this browser-side file.

  const answers = {
    love: form.elements.love.value.trim(),
    good: form.elements.good.value.trim(),
    paid: form.elements.paid.value.trim(),
    world: form.elements.world.value.trim()
  };

  // For now, confirm the form works without pretending that an AI has analysed it.
  console.log("Ikigai answers ready for analysis:", answers);
  resultsMessage.textContent =
    "Your four answers have been collected. AI matching is not connected yet; that's the next development step.";
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
});

editAnswersButton.addEventListener("click", () => {
  results.hidden = true;
  document.querySelector("#love").focus();
});
