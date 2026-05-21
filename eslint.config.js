module.exports = [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        // Node.js globals
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        console: "readonly",
        exports: "readonly",
        global: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        setImmediate: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        clearImmediate: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      // console.warn dan console.error diizinkan, console.log akan di-warn
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Relax beberapa rule untuk Discord bot
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-prototype-builtins": "off",
    },
  },
  {
    ignores: [
      "node_modules/",
      "data/",
      "logs/",
      "infra/",
      "coverage/",
      ".github/",
    ],
  },
];
