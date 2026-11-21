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
        /* Requested design tokens */
        surface: {
          light: '#fbf7ee',
          DEFAULT: '#fbf7ee',
          800: '#1e293b',
          900: '#0f172a',
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        /* Warm aged-paper & ink palette for the printed old-book light mode */
        cream: {
          50: '#fbf7ee',
          100: '#f4ecdc',
          200: '#e9dec8',
          300: '#d8c9ae',
          400: '#a8987e',
          500: '#756550',
          600: '#564838',
          700: '#3d3225',
          800: '#261e15',
          900: '#1a140d',
          950: '#110d08',
        },
        navy: {
          500: '#475569',
          600: '#334155',
          700: '#28354b',
          800: '#1e293b',
          900: '#131c2f',
          950: '#0f172a',
        },
        amber: {
          100: '#f7e7c4',
          200: '#eed095',
          300: '#e2b462',
          400: '#d4973a',
          500: '#b87822',
          600: '#965a15',
          700: '#784310',
          800: '#5f3510',
          900: '#4b2a0f',
          950: '#2c1706',
        },
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#C9D0E0',
          400: '#A7B0C0',
          500: '#9CA3AF',
          600: '#6B7280',
          700: '#4B5563',
          800: '#1F2937',
          900: '#111827',
        },
      },
      fontFamily: {
        book: ['"Newsreader"', '"Lora"', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
}
