module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    // console.warn dan console.error diizinkan, console.log akan di-warn
    "no-console": ["warn", { allow: ["warn", "error"] }],
    // Relax beberapa rule untuk Discord bot
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-constant-condition": ["error", { checkLoops: false }],
    "no-prototype-builtins": "off",
  },
  ignorePatterns: [
    "node_modules/",
    "data/",
    "devops/",
  ],
};
