/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        paper: '#F4EFE6',
        sand: '#E8DCC8',
        ink: '#1C1917',
        muted: '#78716C',
        border: '#E7E0D6',
        slate: '#334155',
        'slate-muted': '#64748B',
        emerald: '#047857',
        'emerald-dark': '#065F46',
        'emerald-light': '#D1FAE5',
        'emerald-accent': '#059669',
        'on-emerald': '#ECFDF5',
        card: '#FFFcf7',
        danger: '#B45309',
      },
    },
  },
  plugins: [],
};
