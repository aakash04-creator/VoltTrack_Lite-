module.exports = {
  content: [require('path').resolve(__dirname, 'index.html'), require('path').resolve(__dirname, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#172554',
        },
      },
      boxShadow: {
        soft: '0 8px 30px rgba(15,36,70,.06)',
      },
    },
  },
  plugins: [],
};
