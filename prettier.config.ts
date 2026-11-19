import { type Config } from "prettier";

const config: Config = {
  plugins: ["prettier-plugin-packagejson", "prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/global.css",
  tailwindFunctions: ["cn"],
};

export default config;
