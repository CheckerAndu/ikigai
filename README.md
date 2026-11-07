# Ikigai Finder

A responsive, browser-based tool for exploring possible directions through four Ikigai-inspired questions:

1. What do you love?
2. What are you good at?
3. What could you be paid for?
4. What does the world need?

The project turns a person's answers into a shortlist of careers to explore. It is designed as a reflection and discovery tool—not as a career test or a system that decides someone's future.

## Features

- Four-question questionnaire based on the project's Ikigai framework.
- Offline recommendation engine: matching runs locally in the browser.
- A database of hundreds of career profiles across many fields.
- Separate comparison of the four dimensions, rather than matching against one combined keyword list.
- Phrase and synonym recognition for common interests and skills.
- Ranked suggestions with explanations, related themes, exploration activities and skills to develop.
- Responsive layout and no build step or package installation required.

## Run the project

1. Download or clone this repository.
2. Open `index.html` in a modern web browser.
3. Enter a few meaningful phrases in each of the four text areas.
4. Select **Explore my Ikigai** to see possible matches.

The matching engine and career data are local JavaScript files, so the core experience does not need an API key, AI service, server or internet connection after the files are available.

## How matching works

The analyser processes each answer separately:

- **Love** is compared with the career's interest tags.
- **Good at** is compared with its skill and strength tags.
- **Paid for** is compared with its professional and work-related tags.
- **World needs** is compared with its contribution and impact tags.

It normalises text, recognises selected phrases and synonyms, and compares the resulting concepts with the tags in each career profile. The four dimension scores are combined into an overall match score. The interest and strengths dimensions receive a slightly higher weight.

The score is a measure of text overlap with this database—not a probability of success, a scientific assessment, or a judgement of a person's abilities. Results depend on the wording of the answers and the coverage of the database. A low score does not mean a career is unsuitable, and a high score does not mean it is the right choice.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, questionnaire and results area |
| `style.css` | Layout, visual design and responsive styling |
| `script.js` | Form handling and rendering of recommendations |
| `analyser.js` | Text normalisation, concept matching and scoring |
| `careers.js` | Offline career profile database |

## Improving the results

For more useful suggestions:

- Write phrases rather than only single words.
- Include examples of activities you enjoy, skills you use and problems you care about.
- Try different wording if a result seems incomplete.
- Treat recommendations as starting points for research and conversations with people in those fields.

## Limitations

The database is curated and cannot represent every job, specialisation, country or educational route. Job titles and requirements vary by location and change over time. The tool does not check local qualifications, salaries, vacancies or labour-market forecasts. Always research those details independently.

The project currently uses transparent rule-based matching. It does not send questionnaire answers to an external AI service.

## Contributing

Career profiles should use the same structure in `careers.js`:

- `id`: unique, URL-friendly identifier
- `title` and `category`
- `description`
- `love`, `good`, `paid`, and `world`: arrays of concise matching tags
- `activities`: safe, accessible ways to explore the field
- `skillsToDevelop`: relevant skills to investigate and practise

Keep tags concise and reusable, and make descriptions and activities specific to the role.

## Credits

Created by [CheckerAndu](https://github.com/CheckerAndu).
