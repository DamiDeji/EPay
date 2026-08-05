import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E3A8A',
          50: '#E8EDF9', 100: '#C5D1F0', 200: '#9EB2E6', 300: '#7793DC',
          400: '#5074D2', 500: '#1E3A8A', 600: '#183072', 700: '#12265A',
          800: '#0C1C42', 900: '#06122A',
        },
        accent: {
          DEFAULT: '#0098EA',
          50: '#E5F4FD', 100: '#B8E3FA', 200: '#8AD2F7', 300: '#5CC1F4',
          400: '#2EB0F1', 500: '#0098EA', 600: '#007AC0', 700: '#005C96',
          800: '#003E6C', 900: '#002042',
        },
        emerald: { DEFAULT: '#10B981' },
        danger: { DEFAULT: '#EF4444', light: '#FEE2E2' },
        warning: { DEFAULT: '#F59E0B', light: '#FEF3C7' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInRight: { '0%': { transform: 'translateX(16px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};

export default config;
