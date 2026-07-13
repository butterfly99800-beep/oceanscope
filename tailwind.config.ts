import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08111f",
        ocean: {
          50: "#f2f7ff",
          100: "#e3eeff",
          500: "#3568ff",
          600: "#244ee6",
          700: "#1f3db8",
        },
        violet: {
          500: "#6d5dfc",
          600: "#5948e8",
        },
      },
      boxShadow: {
        card: "0 18px 45px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
