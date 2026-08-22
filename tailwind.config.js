// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tell Tailwind which files to scan for class names
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Add the MediVault brand colours as named Tailwind colours
      colors: {
        primary: {
          DEFAULT: '#0f3b5c',
          dark: '#0a2c45',
          light: '#e6f0f9',
        },
        accent: {
          DEFAULT: '#1f7b4d',
          light: '#e0f2e9',
        },
      },
      // Custom border radius for the card-heavy design
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
