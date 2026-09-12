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
          DEFAULT: '#1A1D1F',
          light: '#0E6B6F',
          lighter: '#15868A',
          50: '#F4F6F7',
          100: '#E8ECEF',
          200: '#C9D0D4',
          300: '#A8B1B6',
          400: '#7B8388',
          500: '#565D61',
          600: '#3A3F42',
          700: '#26292B',
          800: '#1A1D1F',
          900: '#0F1112',
        },
        brand: {
          DEFAULT: '#26C6C6',
          dark: '#0E6B6F',
          light: '#6FE0E0',
          50: '#E5FAFA',
        },
        gold: {
          DEFAULT: '#C89C5B',
          dark: '#A87D3F',
          light: '#DCBE8B',
          50: '#F8EFE2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(26 29 31 / 0.04), 0 1px 3px 0 rgb(26 29 31 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(26 29 31 / 0.08), 0 2px 4px -2px rgb(26 29 31 / 0.06)',
        popover: '0 12px 32px -8px rgb(26 29 31 / 0.16), 0 4px 8px -4px rgb(26 29 31 / 0.08)',
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
