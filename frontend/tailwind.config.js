/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a1628',
          800: '#0f2040',
          700: '#152b57',
          600: '#1d3a6e',
        },
        ocean: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
      },
    },
  },
  plugins: [],
};
