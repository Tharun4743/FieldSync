/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Obsidian / Dark Zinc Palette
        obsidian: {
          bg: '#0b0b0e',
          subtle: '#101014',
          card: '#141418',
          elevated: '#1a1a20',
          alt: '#16161b',
          border: '#26262e',
          borderSubtle: '#1e1e24',
          input: '#141418',
          inputBorder: '#2e2e38',
        },
        // Brand Primary / Indigo Accent
        brand: {
          primary: '#4f46e5',
          hover: '#6366f1',
          darkHover: '#4338ca',
          tintLight: '#eef2ff',
          borderLight: '#e0e7ff',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Semantic Status
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#f43f5e',
          info: '#0ea5e9',
          purple: '#a855f7',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        xl: '0.75rem',
        lg: '0.5rem',
        full: '9999px',
      },
      boxShadow: {
        cardLight: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        cardDark: '0 4px 24px -2px rgba(0, 0, 0, 0.7), 0 0 0 1px #26262e',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
