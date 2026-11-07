// Offline matching engine. Scores show overlap with concepts represented in the career database.

const conceptGroups = {
  "problem solving": ["problem-solving", "solve problems", "solving problems", "troubleshooting", "debugging", "puzzles", "logic", "analytical thinking", "critical thinking"],
  technology: ["tech", "computers", "computer science", "coding", "programming", "software", "digital tools", "IT", "computing"],
  design: ["designing", "visual design", "graphic design", "product design", "drawing", "architecture", "CAD", "3d modelling", "3d modeling"],
  "helping people": ["helping", "supporting", "care", "service", "volunteering", "working with people", "supporting others", "making a difference"],
  mathematics: ["math", "maths", "numbers", "calculations", "statistics", "algebra", "geometry"],
  science: ["scientific", "experiments", "research", "physics", "biology", "chemistry", "laboratory", "scientific discovery"],
  nature: ["environment", "animals", "outdoors", "climate", "plants", "wildlife", "conservation", "ecosystems"],
  writing: ["stories", "storytelling", "blogging", "journalism", "writing", "creative writing", "content creation"],
  communication: ["speaking", "explaining", "presenting", "teaching", "public speaking", "languages", "conversation"],
  art: ["painting", "illustration", "music", "craft", "photography", "creative arts", "visual arts"],
  aviation: ["aircraft", "airplanes", "airplane", "planes", "flying", "flight", "piloting", "aviation"],
  space: ["astronomy", "spaceflight", "space exploration", "rockets", "satellites", "planetary science", "cosmos"],
  engineering: ["mechanical", "electrical", "civil", "aerospace", "engineering", "mechanics"],
  healthcare: ["medicine", "medical", "nursing", "patient care", "wellbeing", "public health", "health care"],
  business: ["entrepreneurship", "management", "finance", "marketing", "sales", "commerce", "business"],
  leadership: ["leading", "team leadership", "organising", "organizing", "coordination", "management"],
  environment: ["sustainability", "ecology", "renewable energy", "climate action", "environmental protection"],
  justice: ["law", "legal", "rights", "equality", "advocacy", "justice", "human rights"],
  education: ["learning", "education", "tutoring", "instruction", "curriculum", "teaching"],
  data: ["data analysis", "analytics", "datasets", "data science", "visualisation", "visualization", "statistics"],
  robotics: ["robot", "robots", "automation", "mechatronics", "robotics"],
  construction: ["building", "buildings", "construction", "carpentry", "masonry"],
  transport: ["logistics", "shipping", "mobility", "transportation"],
  food: ["cooking", "culinary", "baking", "nutrition", "food science"],
  psychology: ["mental health", "behaviour", "behavior", "counselling", "counseling", "psychology", "emotional wellbeing"],
  research: ["investigation", "investigating", "scientific inquiry", "analysis", "experimentation"],
  creativity: ["creative", "imagination", "inventing", "innovation", "original ideas"],
  teamwork: ["collaboration", "teamwork", "cooperation", "working in a team"],
  organisation: ["organization", "organising", "organizing", "planning", "coordination"],
  communication: ["interpersonal skills", "public relations", "explaining ideas"],
  safety: ["risk management", "reliability", "protection", "safety"],
  geography: ["geographical", "maps", "mapping", "earth science"],
  history: ["heritage", "archaeology", "historical research"],
  electronics: ["circuits", "electrical systems", "embedded systems"],
  mechanics: ["mechanical systems", "machines", "machinery"],
  programming: ["software development", "web development", "coding"],
  physics: ["physical science", "mechanics", "thermodynamics"],
  biology: ["life sciences", "ecology", "anatomy"],
  chemistry: ["chemical science", "materials science"],
  languages: ["translation", "linguistics", "foreign languages"],
  finance: ["accounting", "investment", "banking", "economics"],
  policy: ["public policy", "government", "public administration"],
  media: ["film", "video", "broadcasting", "content"],
  agriculture: ["farming", "horticulture", "crops", "livestock"],
  sport: ["sports", "athletics", "fitness", "coaching"],
  travel: ["tourism", "travelling", "traveling", "exploring places"]
};

const stopWords = new Set([
  "about", "also", "and", "are", "because", "being", "can", "could", "for", "from",
  "good", "have", "into", "just", "like", "love", "make", "more", "much", "need",
  "our", "people", "really", "that", "the", "their", "them", "there", "these",
  "they", "this", "those", "very", "want", "what", "when", "which", "with", "would",
  "you", "your", "able", "things", "thing", "work", "working", "interested", "enjoy"
]);

function normaliseText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularise(word) {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function buildAliasIndex() {
  const index = new Map();
  for (const [concept, aliases] of Object.entries(conceptGroups)) {
    for (const alias of [concept, ...aliases]) index.set(normaliseText(alias), concept);
  }
  return index;
}

const aliasIndex = buildAliasIndex();
const aliasPhrases = [...aliasIndex.entries()].sort((a, b) => b[0].length - a[0].length);

function extractConcepts(value) {
  const text = normaliseText(value);
  if (!text) return [];

  const found = new Set();
  let remaining = " " + text + " ";

  // Recognise longer phrases before individual words.
  for (const [phrase, concept] of aliasPhrases) {
    const paddedPhrase = " " + phrase + " ";
    if (remaining.includes(paddedPhrase)) {
      found.add(concept);
      remaining = remaining.split(paddedPhrase).join(" ");
    }
  }

  for (const rawWord of remaining.split(" ")) {
    const word = singularise(rawWord);
    if (word.length < 3 || stopWords.has(word)) continue;
    found.add(aliasIndex.get(word) || word);
  }
  return [...found];
}

function extractCareerConcepts(tags) {
  const concepts = new Set();
  const cleanTags = (tags || []).map(tag => String(tag).replace(/;/g, " "));

  cleanTags.forEach(tag => extractConcepts(tag).forEach(concept => concepts.add(concept)));

  // Some imported profiles split common phrases into neighbouring tags, e.g. "problem", "solving".
  for (let index = 0; index < cleanTags.length - 1; index++) {
    const pair = cleanTags[index] + " " + cleanTags[index + 1];
    extractConcepts(pair).forEach(concept => {
      if (aliasIndex.has(normaliseText(pair))) concepts.add(concept);
    });
  }
  return concepts;
}

const dimensionVocabulary = Object.fromEntries(
  ["love", "good", "paid", "world"].map(dimension => [
    dimension,
    new Set(careerDatabase.flatMap(career => [...extractCareerConcepts(career[dimension])]))
  ])
);

function conceptWeight(concept) {
  const broad = new Set(["technology", "science", "design", "business", "data", "research", "communication", "creativity"]);
  return broad.has(concept) ? 0.7 : 1;
}

function scoreDimension(userText, careerTags, dimension) {
  const allUserConcepts = extractConcepts(userText);
  const vocabulary = dimensionVocabulary[dimension];
  // Unknown words are not treated as mismatches: the database cannot fairly score concepts it does not contain.
  const recognised = allUserConcepts.filter(concept => vocabulary.has(concept));
  const careerConcepts = extractCareerConcepts(careerTags);
  if (!recognised.length) {
    return { score: 0, matched: [], recognised: 0, unrecognised: allUserConcepts.length };
  }

  const matched = recognised.filter(concept => careerConcepts.has(concept));
  const possibleWeight = recognised.reduce((sum, concept) => sum + conceptWeight(concept), 0);
  const matchedWeight = matched.reduce((sum, concept) => sum + conceptWeight(concept), 0);
  const score = possibleWeight ? Math.round((matchedWeight / possibleWeight) * 100) : 0;

  return {
    score,
    matched,
    recognised: recognised.length,
    unrecognised: allUserConcepts.length - recognised.length
  };
}

function scoreCareer(career, answers) {
  const dimensions = ["love", "good", "paid", "world"];
  const weights = { love: 1.2, good: 1.2, paid: 1, world: 1 };
  const breakdown = {};
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const dimension of dimensions) {
    const result = scoreDimension(answers[dimension] || "", career[dimension], dimension);
    breakdown[dimension] = result;
    // An unanswered or unrecognised dimension is omitted rather than counted as zero.
    if (result.recognised > 0) {
      weightedTotal += result.score * weights[dimension];
      weightTotal += weights[dimension];
    }
  }

  const score = weightTotal ? Math.round(weightedTotal / weightTotal) : 0;
  const matchedConcepts = [...new Set(dimensions.flatMap(dimension => breakdown[dimension].matched))];
  const dimensionsMatched = dimensions.filter(dimension => breakdown[dimension].matched.length > 0).length;
  return { ...career, score, breakdown, matchedConcepts, dimensionsMatched };
}

function findIkigaiMatches(answers, limit = 5) {
  return careerDatabase
    .map(career => scoreCareer(career, answers))
    .filter(career => career.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      b.dimensionsMatched - a.dimensionsMatched ||
      a.title.localeCompare(b.title)
    )
    .slice(0, limit);
}
