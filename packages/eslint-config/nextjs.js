const base = require("./base");

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...base,
  extends: [...base.extends, "next/core-web-vitals"],
  plugins: [...(base.plugins ?? [])],
  rules: {
    ...base.rules,

    // React
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/self-closing-comp": "error",
    "react/jsx-boolean-value": ["error", "never"],
    "react/jsx-no-useless-fragment": "error",

    // Next.js IMG lint rule — enforce next/image
    "@next/next/no-img-element": "error",
  },
  env: {
    ...base.env,
    browser: true,
  },
};
