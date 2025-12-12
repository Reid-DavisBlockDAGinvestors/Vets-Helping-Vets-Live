import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        patriotic: {
          blue: '#0b1f3b',
          navy: '#0a2540',
          gray: '#1f2937',
          red: '#b91c1c',
          white: '#f9fafb'
        }
      }
    }
  },
  plugins: []
} satisfies Config
