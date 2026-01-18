// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["build/**", "node_modules/**"],
  },
  ...obsidianmd.configs.recommended,

  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        ...globals.browser, // standard browser globals (window, document, setTimeout, etc.)
      },
    },

    // Optional project overrides
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: ["Time Tracker, Simple Time Tracker"],
          acronyms: ["OK"],
          enforceCamelCaseLower: true,
        },

      ],
    },
  },
]);