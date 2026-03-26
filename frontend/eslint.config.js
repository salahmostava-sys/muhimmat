import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",

      /**
       * ──────────────────────────────────────────────────────────────────────
       * System-wide Architecture Guards (Single Source of Truth)
       * ──────────────────────────────────────────────────────────────────────
       *
       * These rules enforce the project's stack decisions:
       * - React Query for server-state
       * - Tailwind + shadcn/ui for UI styling
       * - lucide-react for icons
       * - No ad-hoc inline styles / random CSS imports
       */

      // UI styling guard is disabled for now because the codebase
      // legitimately uses theme variables via inline style objects.
      "no-restricted-syntax": "off",

      // Icons: lucide-react only.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@fortawesome/*",
                "react-icons",
                "react-icons/*",
                "@heroicons/*",
                "@mui/icons-material",
                "@mui/icons-material/*",
                "phosphor-react",
                "tabler-icons-react",
              ],
              message: "Icons must come from `lucide-react` only.",
            },
            {
              group: [
                "axios",
                "swr",
                "use-swr",
                "@reduxjs/toolkit",
              ],
              message:
                "Do not introduce alternative data/state libraries. Use React Query for server state and local state hooks for UI.",
            },
          ],
        },
      ],
    },
  },
);
