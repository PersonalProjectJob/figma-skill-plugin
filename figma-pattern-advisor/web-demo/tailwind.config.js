/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'sans-serif'],
        ui: ['"Bricolage Grotesque"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        gray: {
          900: '#0F0F11',
          800: '#1A1A1E',
          700: '#25252A',
          600: '#333333',
          500: '#888890',
          400: '#A0A0A5',
          300: '#C0C0C5',
          200: '#E0E0E5',
          100: '#F5F5F7',
        },
        brand: {
          400: '#00F0FF',
          500: '#00D0DD',
          600: '#00A0AA',
        }
      }
    },
  },
  plugins: [],
}
