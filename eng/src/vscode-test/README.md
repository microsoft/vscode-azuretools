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
so you do not need to import it. The shared setup registers Chai's `should` getter on
`Object.prototype` as well, enabling assertions such as `value.should.equal(expected)`.

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

# Customizing Test Configuration

Use `createVscodeTestConfig` instead of mutating the exported presets:

```js
import { createVscodeTestConfig } from '@microsoft/vscode-azext-eng/vscode-test';

export default createVscodeTestConfig({
    mocha: { ui: 'bdd', timeout: 20000 },
    env: { MY_TEST_FLAG: '1' },
    launchArgs: ['--disable-gpu'],
});
```

Each call returns independent configuration objects and arrays. Mocha options and
environment variables merge with the shared defaults; require hooks and launch
arguments are appended, retaining the TypeScript loader, test globals, and existing
non-Windows user-data isolation. Other supplied properties replace the defaults.
Callbacks and class instances, such as custom reporters, retain their identity.
The default test layout is `test/`; override `files` and `workspaceFolder` for another
layout, or keep using `azExtSrcTestConfig` for `src/test/`.

# Sharing the VS Code Download Cache

To avoid a separate VS Code download for every checkout/worktree, explicitly run:

```sh
azext-link-test-cache --extension-dir ./extensions/vscode-azure
```

This links the extension's `.vscode-test` directory to `VSCODE_TEST_CACHE_DIR`, or
`~/.vscode-test-cache` by default. Windows uses a junction; other platforms use a
directory symlink. Relative paths resolve against the invoking working directory.
`--cache-dir PATH` overrides the destination.

Run this before the extension's first test download. Existing real files/directories
are refused without deleting their contents. Repeating the command with the same
target is safe and repairs a missing target directory. Changing an existing link's
target requires `--replace`; the old cache's contents are never removed. Overlapping
link and cache paths are rejected.
Unavailable filesystem roots are reported as errors rather than retried.

The function is also available without importing the test runner:

```js
import { linkVscodeTestCache } from '@microsoft/vscode-azext-eng/vscode-test/cache';

await linkVscodeTestCache({
    extensionDir: './extensions/vscode-azure',
    cacheDir: './shared-test-cache',
});
```

**Do not run tests sharing this cache concurrently.** Linking the entire directory
also shares installed test extensions and potentially user-data profiles. The shared
non-Windows profile setting reduces profile collisions, but does not isolate download
or extension installation. Linking is deliberately not a postinstall hook or default
test-runner action; disposable CI checkouts can keep their normal local cache.

For standalone Node/Mocha tests, see the [Mocha configuration](../mocha/README.md).

---

[Back to Root](../../README.md)
