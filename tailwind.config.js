/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'gradient-start': '#8B5CF6',
        'gradient-end': '#EC4899',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        'pid-dark': {
          'primary': '#8B5CF6',
          'secondary': '#EC4899', 
          'accent': '#06B6D4',
          'neutral': '#2A2E37',
          'base-100': '#1F2937',
          'base-200': '#111827',
          'base-300': '#0F172A',
          'base-content': '#F9FAFB',
          'info': '#3ABFF8',
          'success': '#36D399',
          'warning': '#FBBD23',
          'error': '#F87272',
        },
        'pid-light': {
          'primary': '#8B5CF6',
          'secondary': '#EC4899',
          'accent': '#06B6D4', 
          'neutral': '#3D4451',
          'base-100': '#ffffff',
          'base-200': '#F2F2F2',
          'base-300': '#E5E6E6',
          'base-content': '#1f2937',
          'info': '#3ABFF8',
          'success': '#36D399',
          'warning': '#FBBD23',
          'error': '#F87272',
        }
      }
    ],
    base: true,
    utils: true,
    logs: true,
    rtl: false,
    prefix: "",
    darkTheme: "pid-dark",
  }
}
