// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}", // Scans your source files for Tailwind classes
  ],
  theme: {
    extend: {}, // Add customizations here if needed later
  },
  plugins: [
    require("tailwindcss-animate"), // Registers the animation plugin
  ],
};
