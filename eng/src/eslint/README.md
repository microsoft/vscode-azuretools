# ESLint Config for Azure Visual Studio Code Extensions

Contains default eslint configuration for Azure extensions.

# Minimal Usage

1. Add `eslint.config.mjs` to the root of your extension package:
```js
// Other configurations exist
export { azExtEslintRecommended as default } from '@microsoft/vscode-azext-eng/eslint';
```

2. Add the script to `package.json`:
```diff
    "scripts": [
+        "lint": "eslint --max-warnings 0"
    ]
```

3. (Recommended) Include `dbaeumer.vscode-eslint` as an extension recommendation in `.vscode/extensions.json`:
```diff
    "recommendations": [
+        "dbaeumer.vscode-eslint",
    ],
```

# Normal Usage

Check out [Container Tools](https://github.com/microsoft/vscode-containers) for a more advanced example,
including custom linter rules. The important file to check out is `eslint.config.mjs`.

---

[Back to Root](../../README.md)
