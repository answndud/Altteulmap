import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const jsxA11yRecommendedWarnRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([ruleName, ruleConfig]) => {
    if (ruleConfig === "off" || ruleConfig === 0) {
      return [ruleName, ruleConfig];
    }

    if (Array.isArray(ruleConfig)) {
      return [ruleName, ["warn", ...ruleConfig.slice(1)]];
    }

    return [ruleName, "warn"];
  }),
);

const eslintConfig = defineConfig([
  globalIgnores([
    ".agents/**",
    ".next/**",
    ".next-dev/**",
    ".open-next/**",
    "apps/admin/**",
    "build/**",
    "dist/**",
    ".wrangler/**",
    "drizzle/**",
    "test-results/**",
    "playwright-report/**",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/client/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...jsxA11yRecommendedWarnRules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      sourceType: "module",
    },
  },
]);

export default eslintConfig;
