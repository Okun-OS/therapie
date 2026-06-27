import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F3A',
          light: '#1A3355',
          lighter: '#243F6B',
          50: '#E8EEF5',
          100: '#C5D3E5',
          200: '#9FB4D4',
          300: '#7592BD',
          400: '#4D6FA0',
          500: '#33517F',
          600: '#1A3355',
          700: '#13294A',
          800: '#0B1F3A',
          900: '#071527',
        },
        brand: {
          DEFAULT: '#F5B800',
          dark: '#D4A000',
          light: '#FCD55C',
          50: '#FEF7E0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(11 31 58 / 0.04), 0 1px 3px 0 rgb(11 31 58 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(11 31 58 / 0.08), 0 2px 4px -2px rgb(11 31 58 / 0.06)',
        popover: '0 12px 32px -8px rgb(11 31 58 / 0.16), 0 4px 8px -4px rgb(11 31 58 / 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
