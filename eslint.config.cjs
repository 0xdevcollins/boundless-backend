const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["node_modules", "dist"],
  },
  {
    files: ["src/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      prettier: require("eslint-plugin-prettier"),
    },
    rules: {
      "no-unused-vars": "warn",
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
];
