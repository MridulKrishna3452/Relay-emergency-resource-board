/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // One strong accent: a calm, trustworthy deep teal.
        brand: {
          50: '#effaf8',
          100: '#d7f2ec',
          200: '#afe4d9',
          300: '#7dcfc0',
          400: '#4bb3a3',
          500: '#2b9687',
          600: '#1f786d',
          700: '#1c6159',
          800: '#1a4e49',
          900: '#18413d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
