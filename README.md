# 🎓 Fatygoras - AI Teacher Environment

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.0-38B2AC.svg?logo=tailwind-css&logoColor=white)
![Gemini API](https://img.shields.io/badge/Google%20Gemini-API-8E75B2.svg?logo=google&logoColor=white)

### 🚀 **[Play with Fatygoras Live Here](https://fatiguita.github.io/Fatygoras/)**

**Fatygoras** is an advanced, interactive AI teaching environment designed to visualize complex concepts. Unlike standard chatbots, Fatygoras acts as a visual tutor, generating dynamic **SVG Whiteboards**, creating **Interactive Coding Playgrounds**, and structuring full **Syllabuses** on the fly.

Built with the latest **Google Gemini Models** (3.0 Pro/Flash & 2.5), it offers a privacy-focused, "Bring Your Own Key" (BYOK) architecture where sessions live in your browser or your local filesystem.

---

## ✨ Key Features

### 🧠 Visual Classroom
*   **Dynamic Whiteboards**: Generates schematic, hand-drawn style SVG diagrams for any topic (Physics, History, Math, Coding).
*   **Deep Explanations**: Provides structured breakdowns with concept definitions, examples, and reference guides.
*   **Smart Context**: The AI remembers previous whiteboards to build knowledge sequentially.

### 🎮 Interactive Playgrounds
*   **Code Sandbox**: Instantly generates functional HTML/JS/CSS applications to demonstrate concepts (e.g., a "Solar System simulation" or a "Verb Conjugation Quiz").
*   **Live Preview**: Run generated code safely within the app.
*   **Downloadable**: Export your playgrounds as standalone `.html` files.

### 📚 Syllabus Architect
*   **Curriculum Design**: Generates structured learning paths from "Introduction" to "Master" levels.
*   **Concept Breakdown**: Extracts key concepts from a syllabus level and feeds them directly into the Classroom for generation.

### 🛠️ Tools & Utilities
*   **Whiteboard Annotation**: Draw, highlight, or write directly on the AI-generated whiteboards.
*   **Vision Analysis**: Ask the AI questions about specific parts of the whiteboard by circling them (Multimodal analysis).
*   **Session Management**: 
    *   Save/Load sessions to LocalStorage.
    *   **Export/Import** entire libraries as ZIP files (includes SVGs, Chat History, and Playgrounds).
*   **Themes**: Switch between Light, Dark, **Chalkboard**, and **Blueprint** modes.

---

## 🚀 Tech Stack

*   **Frontend**: React 18, TypeScript
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS, PostCSS, Typography plugin
*   **AI Integration**: `@google/genai` SDK (Gemini 1.5/2.0/3.0)
*   **Utilities**: `jszip` (Session export/import)

---

## 🛠️ Getting Started

### Prerequisites

1.  **Node.js** (v18+ recommended)
2.  A **Google Gemini API Key**. You can get one at [aistudio.google.com](https://aistudio.google.com/).

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Fatiguita/Fatygoras.git
    cd Fatygoras
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser at `http://localhost:5173`.

---

## 📖 Usage Guide

1.  **Enter API Key**: Click the **Key** icon in the header and paste your Google Gemini API Key. (You can enable "Storage" to persist this locally).
2.  **Choose a Mode**:
    *   **Classroom**: Type a topic (e.g., "Quantum Entanglement") to generate whiteboards.
    *   **Syllabus**: Type a topic and select a difficulty level to generate a course plan.
3.  **Interact**:
    *   **Zoom/Pan**: Use mouse or touch to navigate whiteboards.
    *   **Annotate**: Click the "Pen" icon to draw on the whiteboard.
    *   **Ask**: Open the Chat Assistant (bottom right) to ask specific questions about the content.
4.  **Practice**: Click "Practice this Topic" under a whiteboard to generate a coding playground.

---

## 🤖 Supported Models

Fatygoras supports the following models (selectable via dropdown):

*   **Gemini 3.0 Pro Preview** (Recommended for complex reasoning)
*   **Gemini 3.0 Flash Preview** (Fastest)
*   **Gemini 2.5 Flash / Pro** (Stable alternatives)

*Note: Image generation is handled via SVG code generation, not pixel-based image models, ensuring crisp scalability and editability.*

---

## 📄 License

This project is licensed under the MIT License.
