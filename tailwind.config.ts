import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Geist Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        bg: {
          base: '#080A0F',
          1: '#0C0E14',
          2: '#111520',
          3: '#161B27',
          4: '#1C2130',
        },
        accent: {
          DEFAULT: '#3B82F6',
          2: '#2563EB',
        },
        text: {
          1: '#F0F4FA',
          2: '#8B9BBE',
          3: '#4A566E',
          4: '#2E3A4E',
        },
        brand: {
          green:  '#10B981',
          yellow: '#F59E0B',
          red:    '#EF4444',
          purple: '#8B5CF6',
        },
      },
      animation: {
        'fade-up':   'fadeUp  .22s cubic-bezier(.25,.46,.45,.94) both',
        'fade-in':   'fadeIn  .18s ease both',
        'scale-in':  'scaleIn .2s  cubic-bezier(.25,.46,.45,.94) both',
        'spin-fast': 'spin .65s linear infinite',
      },
      keyframes: {
        fadeUp:  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      borderRadius: {
        'sm': '6px', 'md': '10px', 'lg': '14px', 'xl': '20px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0,0,0,.4), 0 1px 2px rgba(0,0,0,.3)',
        'md': '0 4px 16px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.3)',
        'lg': '0 12px 40px rgba(0,0,0,.6), 0 4px 12px rgba(0,0,0,.4)',
        'xl': '0 24px 64px rgba(0,0,0,.7)',
      },
    },
  },
  plugins: [],
}

export default config
