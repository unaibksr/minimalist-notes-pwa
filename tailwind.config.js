/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#faf8f5',
          100: '#f7f3ec',
          200: '#ede1d0',
          300: '#ddcbb7',
          400: '#c4af94',
          500: '#a89375',
          600: '#8c7a5e',
          700: '#6e614c',
          800: '#52483a',
          900: '#3a3529',
          950: '#2a2a20',
        },
        navy: {
          950: '#0a0f20',
          900: '#0d1428',
          800: '#131d3d',
          700: '#1b294f',
          600: '#233769',
          500: '#2d4584',
          400: '#3b57a4',
          300: '#5a74c2',
          200: '#7a92e0',
          100: '#9db0f0',
        },
        amber: {
          100: '#fef3c7',
          200: '#fecaca',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
        },
        sienna: {
          300: '#c97b52',
          400: '#b97746',
          500: '#a65a32',
          600: '#8a4a28',
        },
      },
    },
  },
  plugins: [],
}