export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        move: '#FA3A4B',
        exercise: '#A3E635',
        stand: '#00C2FF',
        'apple-blue': '#0A84FF',
        'apple-bg': '#000000',
        'apple-surface': '#1C1C1E',
        'apple-card': '#2C2C2E',
        'apple-elevated': '#3A3A3C',
        'apple-separator': '#38383A',
        'apple-label': '#FFFFFF',
        'apple-secondary': '#98989E',
        'apple-tertiary': '#636366',
        'apple-fill': '#787880',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        apple: '13px',
        'apple-lg': '20px',
        'apple-xl': '28px',
      },
    },
  },
  plugins: [],
}
