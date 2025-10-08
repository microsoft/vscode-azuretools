# Test Config for Azure Visual Studio Code Extensions

Contains default test configuration for Azure extensions.

# Sample Usage

1. Add `.vscode-test.mjs` to the root of your extension package:
```js
import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
    {
        // Required: Glob of files to load (can be an array and include absolute paths).
        files: 'src/test/**/*.test.ts',
        // Optional: Version to use, same as the API above, defaults to stable
        version: 'insiders',
        // Optional: Root path of your extension, same as the API above, defaults
        // to the directory this config file is in
        extensionDevelopmentPath: __dirname,
        // Optional: sample workspace to open
        workspaceFolder: `${__dirname}/sampleWorkspace`,
        // Optional: install additional extensions to the installation prior to testing. By
        // default, any `extensionDependencies` from the package.json are automatically installed.
        installExtensions: ['foo.bar'],
        // Optional: additional mocha options to use:
        mocha: {
            // TODO: import TSX
            timeout: 10000,
        },
    },
]);
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
        "${workspaceFolder}/src/**/*.ts"
    ],
},
```

[Back to Root](../../README.md)
