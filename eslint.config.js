import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": hooksPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Notification: "readonly",
        ServiceWorkerRegistration: "readonly",
        PushManager: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        Blob: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        performance: "readonly",
        location: "readonly",
        history: "readonly",
        indexedDB: "readonly",
        IDBKeyRange: "readonly",
        getComputedStyle: "readonly",
        ResizeObserver: "readonly",
        MutationObserver: "readonly",
        DOMException: "readonly",
        AbortController: "readonly",
        CustomEvent: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        React: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "18" },
    },
    rules: {
      // Catch undefined variables — this is the class of bug that caused
      // "Can't find variable: pushNudgeVisible" (state declared in wrong component)
      "no-undef": "error",

      // React Hooks rules — catch hooks called outside components or conditionally
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Suppress noisy rules that don't add safety value here
      "no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "no-useless-assignment": "warn",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "no-console": "off",
    },
  },
  // Service Worker — contexto distinto (self, clients, skipWaiting)
  {
    files: ["src/sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        clients: "readonly",
        skipWaiting: "readonly",
        caches: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        importScripts: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
];
