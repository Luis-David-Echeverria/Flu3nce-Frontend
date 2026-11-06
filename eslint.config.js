import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist", "contract", "coverage", "playwright-report", "test-results", "src/lib/api-schema.d.ts"] },
    {
        files: ["**/*.{ts,tsx,js,mjs}"],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
        plugins: { "react-hooks": reactHooks },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": "allow-with-description" }],
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
        },
    },
    {
        // Las pruebas imitan APIs del navegador (dictado, portapapeles) con clases y dobles sueltos.
        files: ["**/*.test.{ts,tsx}", "src/test/**"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-this-alias": "off",
        },
    },
);
