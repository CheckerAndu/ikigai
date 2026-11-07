// Offline matching engine. It compares answer concepts with career tags.
const conceptGroups = {
  "problem solving":["problem-solving","problem solving","solve problems","troubleshooting","puzzles","logic"],
  "technology":["tech","computers","computer","coding","programming","digital","software"],
  "design":["designing","drawing","visual","creative design","architecture"],
  "helping people":["helping","supporting","care","people","volunteering"],
  "mathematics":["math","maths","numbers","calculations"],
  "science":["scientific","experiments","research","physics","biology","chemistry"],
  "nature":["environment","animals","outdoors","climate","plants"],
  "writing":["stories","文章","blogging","journalism"],
  "communication":["speaking","explaining","presenting","teaching"],
  "art":["painting","illustration","music","craft"]
};

function normaliseText(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+#\s-]/g, " ");
}

function extractConcepts(text) {
  const normalised = normaliseText(text);
  const words = normalised.split(/\s+/).filter(word => word.length > 2);
  const found = new Set(words);
  for (const [concept, variants] of Object.entries(conceptGroups)) {
    if (variants.some(variant => normalised.includes(variant))) found.add(concept);
  }
  return [...found];
}

function scoreCareer(career, answers) {
  const dimensions = ["love", "good", "paid", "world"];
  const weights = {love: 1.15, good: 1.15, paid: 1, world: 1};
  const breakdown = {};
  let weightedTotal = 0;
  let weightTotal = 0;
  for (const dimension of dimensions) {
    const userConcepts = extractConcepts(answers[dimension] || "");
    const careerTags = career[dimension] || [];
    const matched = userConcepts.filter(concept =>
      careerTags.some(tag => {
        const tagConcepts = extractConcepts(tag);
        return tagConcepts.includes(concept) || concept === tag;
      })
    );
    const score = userConcepts.length ? Math.min(100, Math.round((matched.length / Math.min(userConcepts.length, 8)) * 100)) : 0;
    breakdown[dimension] = {score, matched};
    weightedTotal += score * weights[dimension];
    weightTotal += weights[dimension];
  }
  const score = Math.round(weightedTotal / weightTotal);
  const matchedConcepts = [...new Set(Object.values(breakdown).flatMap(item => item.matched))];
  return {...career, score, breakdown, matchedConcepts};
}

function findIkigaiMatches(answers, limit = 5) {
  return careerDatabase
    .map(career => scoreCareer(career, answers))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
