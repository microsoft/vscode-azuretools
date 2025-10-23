# Webpack Config for Azure Visual Studio Code Extensions

Contains default Webpack configuration for Azure extensions.

# Minimal Usage

1. Add `webpack.config.mjs` to the root of your extension package:
```js
import { autoSelectWebpackConfig } from '@microsoft/vscode-azext-eng/webpack';
export default autoSelectWebpackConfig();
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

# Normal Usage

Check out [Container Tools](https://github.com/microsoft/vscode-containers) for a more advanced example,
including watch mode, custom entry points, and other options. The important files to check out are
`webpack.config.mjs`, `package.json` scripts, `.vscode/tasks.json` and `.vscode/launch.json` configurations,
and extensions with problem matchers in `.vscode/extensions.json`.

---

[Back to Root](../../README.md)
