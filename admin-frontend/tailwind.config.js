/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Dynamic primary scale — RGB values set by CSS theme files.
           Supports Tailwind opacity modifiers: bg-primary-600/50 */
        primary: {
          50:  'rgb(var(--color-p50)  / <alpha-value>)',
          100: 'rgb(var(--color-p100) / <alpha-value>)',
          200: 'rgb(var(--color-p200) / <alpha-value>)',
          300: 'rgb(var(--color-p300) / <alpha-value>)',
          400: 'rgb(var(--color-p400) / <alpha-value>)',
          500: 'rgb(var(--color-p500) / <alpha-value>)',
          600: 'rgb(var(--color-p600) / <alpha-value>)',
          700: 'rgb(var(--color-p700) / <alpha-value>)',
          800: 'rgb(var(--color-p800) / <alpha-value>)',
          900: 'rgb(var(--color-p900) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      animation: {
        'fade-in':    'fadeIn    0.25s ease-out both',
        'slide-up':   'slideUp   0.32s ease-out both',
        'slide-down': 'slideDown 0.25s ease-out both',
        'scale-in':   'scaleIn   0.20s ease-out both',
        'scale-up':   'scaleUp   0.22s cubic-bezier(.175,.885,.32,1.275) both',
        'page-enter': 'slideUp   0.38s cubic-bezier(.25,.46,.45,.94) both',
        'float':      'float     3.2s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2.2s ease-in-out infinite',
        'spin-slow':  'spin      10s  linear      infinite',
        'bounce-in':  'bounceIn  0.5s cubic-bezier(.175,.885,.32,1.275) both',
        'shimmer':    'shimmer   1.7s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                                             '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(18px)' },              '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-10px)' },             '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { '0%': { opacity: '0', transform: 'scale(0.94)' },                  '100%': { opacity: '1', transform: 'scale(1)' } },
        scaleUp:   { '0%': { opacity: '0', transform: 'scale(0.87) translateY(8px)' },  '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        float:     { '0%, 100%': { transform: 'translateY(0)' },                         '50%': { transform: 'translateY(-7px)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' },                                       '50%': { opacity: '0.55' } },
        bounceIn:  { '0%': { opacity: '0', transform: 'scale(0.75)' }, '60%': { opacity: '1', transform: 'scale(1.06)' }, '80%': { transform: 'scale(0.97)' }, '100%': { transform: 'scale(1)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' },                            '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
