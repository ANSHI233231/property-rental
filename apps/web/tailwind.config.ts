import type { Config } from "tailwindcss";

/** Design tokens ported verbatim from prototype/assets/styles.css */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        navy: "#1A237E",
        "royal-blue": "#1565C0",
        saffron: "#FF6F00",
        charcoal: "#212121",
        slate: "#546E7A",
        "off-white": "#F8F9FA",
        "light-gray": "#ECEFF1",
        "mid-gray": "#CFD8DC",

        // Status
        "status-paid": "#2E7D32",
        "status-partial": "#F57F17",
        "status-overdue": "#C62828",
        "status-prepaid": "#0277BD",

        // Status backgrounds
        "bg-paid": "#E8F5E9",
        "bg-partial": "#FFF8E1",
        "bg-overdue": "#FFEBEE",
        "bg-prepaid": "#E3F2FD",
        "bg-closed": "#ECEFF1",
      },
      fontFamily: {
        poppins: ["var(--font-poppins)", "system-ui", "sans-serif"],
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "8px",
        modal: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
