# Test Config for Azure Visual Studio Code Extensions

Contains default test configuration for Azure extensions.

# Sample Usage

1. Add `.vscode-test.mjs` to the root of your extension package:
```js
export { azExtTestConfig as default } from '@microsoft/vscode-azext-eng';
```

2. Add the script to `package.json`:
```diff
    "scripts": [
+        "test": "vscode-test"
    ]
```

3. Add a launch configuration to `.vscode/launch.json`:
```json
{
	"type": "extensionHost",
	"request": "launch",
	"name": "My extension tests",
 	"testConfiguration": "${workspaceFolder}/.vscode-test.mjs",
    "preLaunchTask": "${defaultBuildTask}",
    "env": {
        "DEBUGTELEMETRY": "1",
    },
    "outFiles": [ // We are using TSX so out files *are* the source files
        "${workspaceFolder}/src/**/*.{ts,mts,cts}"
    ],
},
```

[Back to Root](../../README.md)
