const base = require("./base");

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...base,
  parserOptions: {
    ...base.parserOptions,
    project: "tsconfig.json",
    tsconfigRootDir: process.cwd(),
  },
  plugins: [...(base.plugins ?? [])],
  extends: [
    ...base.extends,
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  rules: {
    ...base.rules,

    // NestJS uses decorators and parameter properties heavily
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",

    // Class-based patterns
    "@typescript-eslint/no-extraneous-class": "off",
    "@typescript-eslint/consistent-type-imports": "off",
  },
  env: {
    ...base.env,
    node: true,
  },
};
