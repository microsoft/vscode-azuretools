# VS Code Test Config for Azure Visual Studio Code Extensions

Contains default VS Code test configuration for Azure extensions.

# Minimal Usage

1. Add `.vscode-test.mjs` to the root of your extension package:
```js
// Other configurations exist
export { azExtTestConfig as default } from '@microsoft/vscode-azext-eng/vscode-test';
```

2. Add the script to `package.json`:
```diff
    "scripts": [
+        "test": "vscode-test"
    ]
```

3. (Recommended) Add a launch configuration to `.vscode/launch.json`:
```json
{
    "label": "Run Tests",
	"type": "extensionHost",
	"request": "launch",
 	"testConfiguration": "${workspaceFolder}/.vscode-test.mjs",
    "env": {
        "DEBUGTELEMETRY": "1",
    },
    "outFiles": [
        "${workspaceFolder}/dist/**/*.{js,mjs,cjs}",
        "${workspaceFolder}/test/**/*.{ts,mts,cts}", // We are using TSX so out files *are* the source files
    ],
    "preLaunchTask": "${defaultBuildTask}",
},
```

---

[Back to Root](../../README.md)
