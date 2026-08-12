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

# Test Globals

Mocha's globals (`describe`, `it`, `suite`, `test`, ...) are declared for you. The
[chai-as-promised](https://www.chaijs.com/plugins/chai-as-promised/) plugin is registered automatically, so assertions
like `await expect(thing()).to.be.rejectedWith(/.../)` are available. Chai's `expect` is also registered as a global,
so you do not need to import it.

To get the types for all of it, add a single entry to the `types` array in your tsconfig.json:
```jsonc
    "types": [
        "node",
        "@microsoft/vscode-azext-eng/mocha/test-globals"
    ]
```
> You do not need `mocha` or `chai-as-promised` entries, you do not need `@types/mocha` as a dependency, and you do not
> need to add `chai` to your dependencies. Importing `expect` from `chai` explicitly still works if you prefer that
> style.
>
> **Using pnpm?** Because `chai` and `chai-as-promised` come in transitively through this package, pnpm's default
> isolated `node_modules` layout may not make them resolvable from your extension. If you hit resolution errors, hoist
> them via `pnpm-workspace.yaml`:
> ```yaml
> publicHoistPattern:
>   - chai
>   - chai-as-promised
> ```

---

[Back to Root](../../README.md)
