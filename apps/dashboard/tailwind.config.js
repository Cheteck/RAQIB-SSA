/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'surface-container-lowest': '#06090e',
        'surface-container-low': '#0a1019',
        'surface-container': '#0f1724',
        'surface-container-high': '#152033',
        'surface-container-highest': '#1c2c44',
        primary: '#b8edff',
        'primary-container': '#42d9ff',
        'primary-fixed-dim': '#3fd7fd',
        tertiary: '#72fdc4',
        'tertiary-container': '#52e0a9',
        error: '#ffb4ab',
        'error-container': '#93000a',
        'on-surface': '#dfe2eb',
        'on-surface-variant': '#9cb1bf',
        outline: '#4b6478',
        'outline-variant': '#223547',
      },
      fontFamily: {
        sans: ['Geist', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
