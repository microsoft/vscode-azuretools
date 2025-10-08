# ESBuild Config for Azure Visual Studio Code Extensions

Contains default esbuild configuration for Azure extensions.

# Sample Usage

1. Add `esbuild.mjs` to the root of your extension package:
```js
// Many other configurations exist
import { azExtEsbuildConfigProd } from '@microsoft/vscode-azext-eng';
import { build } from 'esbuild';

await build(azExtEsbuildConfigProd);
```

2. Add the script to `package.json`:
```diff
    "scripts": [
+        "build": "node esbuild.mjs"
    ]
```

[Back to Root](../../README.md)
