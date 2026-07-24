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
      "max-lines": [
        "warn",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["warn", 15],
      "no-unused-expressions": "error",
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "warn",
      "no-return-await": "warn",
    },
  },
  {
    files: ["src/persistence/**/*.js", "src/lib/**/*.js"],
    rules: {
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 12],
    },
  },
  {
    files: [
      "src/commands/**/*.js",
      "src/events/**/*.js",
      "src/features/alarm/**/*.js",
      "src/features/lyrics/**/*.js",
      "src/features/music/**/*.js",
      "src/features/fixembed/**/*.js",
      "src/features/tempvc/interface*.js",
      "src/features/tempvc/tempVcService.js",
      "src/features/tempvc/voiceRole*.js",
      "src/integrations/**/*.js",
      "src/interactions/buttons/**/*.js",
      "src/dashboard/**/*.js",
      "src/loaders/**/*.js",
      "scripts/**/*.js",
    ],
    rules: {
      "max-lines": "off",
      complexity: "off",
      "prefer-const": "off",
      "no-return-await": "off",
    },
  },
  {
    files: ["src/lib/logger.js", "tests/**/*.js", "scripts/**/*.js"],
    rules: {
      "no-console": ["error", { allow: ["log", "warn", "error"] }],
      "max-lines": "off",
      complexity: "off",
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
      "src/dashboard/public/",
    ],
  },
];
