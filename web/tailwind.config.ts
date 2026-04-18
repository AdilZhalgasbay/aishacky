import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'sans-serif'],
      },
      colors: {
        primary: '#2563EB',
        'primary-dark': '#1d4ed8',
        'primary-light': '#dbeafe',
        secondary: '#0EA5E9',
        cta: '#F97316',
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563EB',
          600: '#1d4ed8',
          700: '#1e40af',
        },
      },
    },
  },
  plugins: [],
}

export default config
