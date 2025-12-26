/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        chalkboard: {
          900: '#1a1a1a',
          800: '#2b2b2b',
          700: '#3d3d3d',
        },
        paper: '#fdfbf7',
      },
      fontFamily: {
        hand: ['"Comic Sans MS"', '"Chalkboard SE"', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}