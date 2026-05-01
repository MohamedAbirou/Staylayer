/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "../../packages/puck-components/src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "0.5rem",
    },
  },
  plugins: [],
};
