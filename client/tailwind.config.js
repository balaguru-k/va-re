/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          500: '#DC143C',
          600: '#760B20',
          700: '#C50B34',
        },
      },
      backgroundImage: {
        'sidebar-gradient': 'linear-gradient(180deg, #2d1b2e 0%, #4a1d3a 90%, #DC143C 100%)',
        'sidebar-active': 'linear-gradient(90deg, #DC143C 0%, #760B20 133.82%)',
        'btn-primary': 'linear-gradient(90deg, #DC143C 0%, #760B20 133.82%)',
        'btn-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'btn-gradient-red': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      }
    },
  },
  plugins: [],
}