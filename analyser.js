// Transparent offline matching engine. It compares each answer with the matching Ikigai dimension.

const conceptGroups = {
  "problem solving": ["problem solving", "problem-solving", "solve problems", "troubleshooting", "debugging", "puzzles", "logic"],
  technology: ["tech", "computers", "computer science", "coding", "programming", "software", "digital tools", "IT"],
  design: ["designing", "visual design", "graphic design", "product design", "drawing", "architecture", "CAD"],
  "helping people": ["helping", "supporting", "care", "service", "volunteering", "working with people"],
  mathematics: ["math", "maths", "numbers", "calculations", "statistics", "algebra"],
  science: ["scientific", "experiments", "research", "physics", "biology", "chemistry", "laboratory"],
  nature: ["environment", "animals", "outdoors", "climate", "plants", "wildlife", "conservation"],
  writing: ["stories", "storytelling", "blogging", "journalism", "writing"],
  communication: ["speaking", "explaining", "presenting", "teaching", "public speaking", "languages"],
  art: ["painting", "illustration", "music", "craft", "photography", "creative arts"],
  aviation: ["aircraft", "airplanes", "planes", "flying", "flight", "piloting"],
  space: ["astronomy", "spaceflight", "space exploration", "rockets", "satellites", "planetary science"],
  engineering: ["mechanical", "electrical", "civil", "aerospace", "engineering"],
  healthcare: ["medicine", "medical", "nursing", "patient care", "wellbeing", "public health"],
  business: ["entrepreneurship", "management", "finance", "marketing", "sales", "commerce"],
  leadership: ["leading", "team leadership", "organising", "organizing", "coordination"],
  environment: ["sustainability", "ecology", "renewable energy", "climate action"],
  justice: ["law", "legal", "rights", "equality", "advocacy", "justice"],
  education: ["learning", "education", "tutoring", "instruction", "curriculum"],
  data: ["data analysis", "analytics", "datasets", "data science", "visualisation", "visualization"],
  robotics: ["robot", "robots", "automation", "mechatronics"],
  construction: ["building", "buildings", "construction", "carpentry", "masonry"],
  transport: ["logistics", "shipping", "mobility", "transportation"],
  food: ["cooking", "culinary", "baking", "nutrition", "food science"],
  psychology: ["mental health", "behaviour", "behavior", "counselling", "counseling", "心理学"],
  research: ["investigation", "investigating", "scientific inquiry", "analysis"]
};

const stopWords = new Set([
  "about", "also", "and", "are", "because", "being", "can", "could", "for", "from",
  "good", "have", "into", "just", "like", "love", "make", "more", "much", "need",
  "our", "people", "really", "that", "the", "their", "them", "there", "these",
  "they", "this", "those", "very", "want", "what", "when", "which", "with", "would",
  "you", "your", "able", "things", "thing", "work", "working"
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
    for (const alias of [concept, ...aliases]) {
      index.set(normaliseText(alias), concept);
    }
  }
  return index;
}

const aliasIndex = buildAliasIndex();
const aliasPhrases = [...aliasIndex.entries()].sort((a, b) => b[0].length - a[0].length);

function extractConcepts(value) {
  const text = normaliseText(value);
  if (!text) return [];

  const found = new Set();
  let remaining = text;

  // Match longer known phrases first so "data analysis" is not reduced to unrelated single words.
  for (const [phrase, concept] of aliasPhrases) {
    const escaped = phrase.replace(/[.*+?^\u007b}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("(^| )" + escaped + "(?= |$)", "g");
    if (pattern.test(remaining)) {
      found.add(concept);
      remaining = remaining.replace(pattern, " ");
    }
  }

  for (const rawWord of remaining.split(" ")) {
    const word = singularise(rawWord);
    if (word.length < 3 || stopWords.has(word)) continue;
    found.add(aliasIndex.get(word) || word);
  }
  return [...found];
}

function conceptWeight(concept) {
  // Broad terms carry less information than specific skills or interests.
  const broad = new Set(["technology", "science", "design", "business", "data", "research", "communication"]);
  return broad.has(concept) ? 0.65 : 1;
}

function scoreDimension(userText, careerTags) {
  const userConcepts = extractConcepts(userText);
  const careerConcepts = new Set((careerTags || []).flatMap(tag => extractConcepts(tag)));
  if (!userConcepts.length) return { score: 0, matched: [], total: 0 };

  const matched = userConcepts.filter(concept => careerConcepts.has(concept));
  const possibleWeight = userConcepts.reduce((sum, concept) => sum + conceptWeight(concept), 0);
  const matchedWeight = matched.reduce((sum, concept) => sum + conceptWeight(concept), 0);
  const score = possibleWeight ? Math.round((matchedWeight / possibleWeight) * 100) : 0;
  return { score, matched, total: userConcepts.length };
}

function scoreCareer(career, answers) {
  const dimensions = ["love", "good", "paid", "world"];
  const weights = { love: 1.2, good: 1.2, paid: 1, world: 1 };
  const breakdown = {};
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const dimension of dimensions) {
    const result = scoreDimension(answers[dimension] || "", career[dimension]);
    breakdown[dimension] = result;
    weightedTotal += result.score * weights[dimension];
    weightTotal += weights[dimension];
  }

  const score = Math.round(weightedTotal / weightTotal);
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
