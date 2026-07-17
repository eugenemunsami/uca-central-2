/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1A1A1A', 900: '#101010', 800: '#1A1A1A', 700: '#232323', 600: '#2E2E2E', 500: '#3A3A3A', 400: '#4A4A4A' },
        lime: { DEFAULT: '#9FD150', dark: '#7FB033', soft: 'rgba(159,209,80,0.12)' },
        flame: { DEFAULT: '#EE4823', dark: '#C83514', soft: 'rgba(238,72,35,0.12)' },
        jade: { DEFAULT: '#19A06E', dark: '#0F7E56', soft: 'rgba(25,160,110,0.12)' },
        amberx: { DEFAULT: '#F5B942', dark: '#C98F1F', soft: 'rgba(245,185,66,0.12)' },
      },
      fontFamily: {
        display: ['Roboto', 'Arial', 'sans-serif'],
        body: ['Arial', 'Helvetica', 'sans-serif'],
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(238,72,35,0.45)' }, '70%': { boxShadow: '0 0 0 10px rgba(238,72,35,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(238,72,35,0)' } },
      },
      animation: {
        'fade-up': 'fade-up .4s ease-out both',
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
}
