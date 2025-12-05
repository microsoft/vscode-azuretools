# VS Code Test Config for Azure Visual Studio Code Extensions

Contains default VS Code test configuration for Azure extensions.

# Minimal Usage

1. Add the vscode-test dev dependencies. They are optional peer dependencies of this package, which
   will control the version. As such, use `*` as the desired version.
    ```diff
        "devDependencies": {
    +        "@vscode/test-cli": "*",
    +        "@vscode/test-electron": "*"
        }
    ```

1. Add `.vscode-test.mjs` to the root of your extension package:
    ```js
    // Other configurations exist
    export { azExtTestConfig as default } from '@microsoft/vscode-azext-eng/vscode-test';
    ```

1. Add the script to `package.json`:
    ```diff
        "scripts": [
    +        "test": "vscode-test"
        ]
    ```

1. (Recommended) Add a launch configuration to `.vscode/launch.json`:
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
