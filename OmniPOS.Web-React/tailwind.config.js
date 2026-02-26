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
        bg: "rgb(var(--bg) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        glass: "rgb(var(--glass-bg) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        'primary-glow': 'rgb(var(--primary) / 0.15)',
        'secondary-glow': 'rgb(var(--secondary) / 0.15)',
        accent: '#f472b6',
        success: '#34d399',
        warning: '#fbbf24',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
