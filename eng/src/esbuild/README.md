# ESBuild Config for Azure Visual Studio Code Extensions

Contains default esbuild configuration for Azure extensions.

# Minimal Usage

1. Add `esbuild.mjs` to the root of your extension package:
```js
// Many other configurations exist
import { azExtEsbuildConfigProd } from '@microsoft/vscode-azext-eng/esbuild';
import { build } from 'esbuild';

await build(azExtEsbuildConfigProd);
```

2. Add the script to `package.json`:
```diff
    "scripts": [
+        "build": "node esbuild.mjs"
    ]
```

3. (Recommended) esbuild does not do type-checking. Add a type-checking script to `package.json`:
```diff
    "scripts": [
+        "check": "tsc --noEmit"
    ]
```

# Normal Usage

Check out [Container Tools](https://github.com/microsoft/vscode-containers) for a more advanced example,
including watch mode, custom entry points, and other options. The important files to check out are
`esbuild.mjs`, `package.json` scripts, `.vscode/tasks.json` and `.vscode/launch.json` configurations,
and extensions with problem matchers in `.vscode/extensions.json`.

---

[Back to Root](../../README.md)
