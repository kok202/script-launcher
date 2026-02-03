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
        accent: {
          DEFAULT: '#0a84ff',
          hover: '#409cff',
          dark: '#007aff',
        },
        danger: '#ff453a',
        success: '#30d158',
        warning: '#ffd60a',
        js: '#c9a800',
        python: '#3776ab',
        shell: '#4EAA25',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'window': '0 12px 40px rgba(0, 0, 0, 0.5)',
        'window-light': '0 12px 40px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}
