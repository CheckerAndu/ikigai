const form = document.querySelector("#ikigai-form");
const results = document.querySelector("#results");
const resultsMessage = document.querySelector("#results-message");
const editAnswersButton = document.querySelector("#edit-answers");
const findButton = document.querySelector("#find-button");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const answers = {
    love: form.elements.love.value.trim(),
    good: form.elements.good.value.trim(),
    paid: form.elements.paid.value.trim(),
    world: form.elements.world.value.trim()
  };

  findButton.disabled = true;
  findButton.textContent = "Finding your matches...";
  resultsMessage.replaceChildren();

  // All matching happens locally; no API, account or network request is used.
  const matches = findIkigaiMatches(answers, 5);

  if (!matches.length || matches.every(match => match.score === 0)) {
    const message = document.createElement("p");
    message.textContent = "We couldn't find strong matches yet. Try adding more specific interests, skills or causes to your answers.";
    resultsMessage.appendChild(message);
  } else {
    matches.forEach((career, index) => {
      const card = document.createElement("article");
      card.className = "career-card";

      const rank = document.createElement("span");
      rank.className = "career-rank";
      rank.textContent = `MATCH ${index + 1}`;

      const title = document.createElement("h3");
      title.textContent = career.title;

      const category = document.createElement("p");
      category.className = "career-category";
      category.textContent = career.category;

      const score = document.createElement("div");
      score.className = "match-score";
      score.textContent = `${career.score}% recognised-theme match`;

      const description = document.createElement("p");
      description.textContent = career.description;

      const why = document.createElement("p");
      why.className = "match-reason";
      const matched = career.matchedConcepts.slice(0, 5);
      why.textContent = matched.length
        ? `Related themes in your answers: ${matched.join(", ")}.`
        : "This is an exploratory suggestion based on the wider profile.";

      const activitiesTitle = document.createElement("h4");
      activitiesTitle.textContent = "Try exploring";
      const activities = document.createElement("ul");
      career.activities.forEach(text => {
        const item = document.createElement("li");
        item.textContent = text;
        activities.appendChild(item);
      });

      const skillsTitle = document.createElement("h4");
      skillsTitle.textContent = "Skills to develop";
      const skills = document.createElement("p");
      skills.textContent = career.skillsToDevelop.join(" · ");

      card.append(rank, title, category, score, description, why, activitiesTitle, activities, skillsTitle, skills);
      resultsMessage.appendChild(card);
    });
  }

  results.hidden = false;
  results.scrollIntoView({behavior: "smooth", block: "start"});
  findButton.disabled = false;
  findButton.innerHTML = 'Explore my Ikigai <span aria-hidden="true">↗</span>';
});

editAnswersButton.addEventListener("click", () => {
  results.hidden = true;
  document.querySelector("#love").focus();
});
