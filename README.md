# Fatygoras - AI Teacher Environment

Fatygoras is an interactive AI teaching assistant that generates SVG whiteboards, explains abstract concepts visually, and creates interactive coding playgrounds. It uses the Gemini API (Flash/Pro) to deliver tailored educational content.

## Features

- **Visual Learning**: Generates hand-drawn style SVG whiteboards for any topic.
- **Course Architect**: Creates full syllabi from Intro to Master level.
- **Interactive Playgrounds**: Generates functional HTML/JS apps to practice concepts.
- **Session Management**: Import/Export sessions (ZIP), Local Storage support.
- **Themes**: Light, Dark, Chalkboard, and Blueprint modes.
- **Gemini 2.5/3.0 Support**: Toggle between the latest models.

## Getting Started

### Prerequisites

- Node.js installed.
- A Google Gemini API Key.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Fatiguita/Fatygoras.git
   cd Fatygoras
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## Deployment

### GitHub Pages

This project is configured to deploy to GitHub Pages.

1. Ensure the `base` in `vite.config.ts` matches your repository name (default: `/Fatygoras/`).
2. Run the deploy script:
   ```bash
   npm run deploy
   ```
   This will build the project and push the `dist` folder to the `gh-pages` branch.

## License

MIT
