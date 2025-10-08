# Webpack Config for Azure Visual Studio Code Extensions

1. Add `webpack.config.mjs` to the root of your extension package:
```js
// Many other configurations exist
export { prodWebpackConfig as default } from '@microsoft/vscode-azext-eng';
```

2. Add the script to `package.json`:
```diff
    "scripts": [
+        "build": "webpack"
    ]
```

3. (Recommended) webpack with esbuild-loader does not do type-checking. Add a type-checking script to `package.json`:
```diff
    "scripts": [
+        "check": "tsc --noEmit"
    ]
```

[Back to Root](../../README.md)

Looking at what we need from the original.

- VSCode extern
- Copy plugin for resources SVGs. Something to fix executable bit?
- Entrypoint fixes
- Source map stuff?
- Terser settings
- ESBuild loader settings
- Ignore some warnings

Looking at what we can probably skip for now.

- Webworker everything, replacements, polyfills etc.
