const base = require("./base");

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...base,
  extends: [
    ...base.extends,
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  plugins: [...(base.plugins ?? []), "react", "react-hooks", "react-refresh"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    ...base.rules,

    // React
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/self-closing-comp": "error",
    "react/jsx-boolean-value": ["error", "never"],
    "react/jsx-no-useless-fragment": "error",
    "react/display-name": "warn",

    // React Hooks
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // Vite HMR
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
  env: {
    ...base.env,
    browser: true,
  },
};
