# Ikigai Finder

A small, responsive website exploring the four Ikigai questions:
- What do you love to do?
- What are you good at?
- What could you be paid for?
- What does the world need?

## Run locally

Open `index.html` in a browser. No build tools are required for the current frontend.

## Current status

The first page and form validation are in place. The AI analysis is intentionally not connected yet.

## Suggested next steps

1. Try the page on desktop and mobile, and adjust the CSS to make it feel like your own design.
2. Improve the example placeholders and the question wording.
3. Add useful client-side feedback (for example, a character count or clearer validation).
4. Plan a server-side endpoint for AI analysis. Keep API credentials out of `script.js`.
5. Design a structured AI response that returns several possible directions, evidence from all four answers, uncertainties, and practical next steps.

## Project structure

- `index.html` — page structure and form
- `style.css` — layout, colors, responsive design
- `script.js` — form behavior (AI integration is a future task)
