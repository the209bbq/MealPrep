/** @type {import('tailwindcss').Config} */
const { tailwindThemeColors } = require('./config/theme.cjs');

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tailwindThemeColors(),
      // Approved design (D-2): Figtree everywhere, softer card corners.
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: { '2xl': '18px', '3xl': '24px' },
    },
  },
  plugins: [],
};
