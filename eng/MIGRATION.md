# Universal steps
> [Sample PR](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1000/files)
1. In package.json, remove dev dependencies that are covered by this package. This includes everything related to
   linting (eslint), bundling (esbuild), testing (mocha, chai, VS Code testing), and publish (vsce). Remove
   typescript as well.
1. Spend some time validating the remaining dependencies (dev and real), to see if they are actually in use.
1. Run `npm i`. Briefly revel in your much-smaller package-lock.json.
1. No, seriously, `npm i` now before you install the eng pkg in the next step, so that things get updated.
1. Run `npm i --save-dev @microsoft/vscode-azext-eng` to install the latest eng package. Bye bye small package-lock.json.
1. Update your .nvmrc to Node 22+, and update `@types/node` accordingly. The minimum VS Code version for Node 22 is 1.101.0.
   As appropriate, add a minimum VS Code engine version to your package.json as well.
1. If needed, update `@microsoft/vscode-azext-utils` to 4.0.2 to get the replacements for TestUserInput, TestActionContext, etc.

# Migrating an NPM package to use this
This is relatively easy.

1. Follow the subsection above on [universal steps](#universal-steps).
1. Update your tsconfig.json to use target=es2022, lib=es2022, module=es2022, moduleResolution=bundler.
1. Update your build scripts to build combined CJS+ESM. If needed, also update your package entrypoints.
1. Rewrite files in the .vscode folder. See [Containers Extensibility](https://github.com/microsoft/vscode-docker-extensibility/tree/main/.vscode)
   for examples.
1. Follow the subsection below on [linting](#linting).
1. Follow the subsection below on [testing](#tests).

# Migrating a VS Code extension to use this
Hard mode engage!

1. Follow the subsection above on [universal steps](#universal-steps).
1. As needed, add the following as dev dependencies. Use `*` for the desired version--they are optional peer
   dependencies in this package, and you don't need to control the version from the extension. Then do `npm i` again.
    ```json
    "devDependencies": {
        "@vscode/test-cli": "*",
        "@vscode/test-electron": "*",
        "@vscode/vsce": "*",
        "esbuild": "*",
        "esbuild-plugin-copy": "*"
    }
    ```
1. Update your tsconfig.json to use target=es2022, lib=es2022, module=nodenext, moduleResolution=nodenext.
   > [Sample PR](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1001/files)
1. Rewrite main.js at the root, it will look more like [this](https://github.com/microsoft/vscode-containers/blob/main/main.js).
   You no longer use an environment variable to switch between loading the bundled or unbundled code--there is only the bundle.
   > [Sample PR](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1002/files)
1. Rewrite files in the .vscode folder. See [Container Tools](https://github.com/microsoft/vscode-containers/tree/main/.vscode)
   for examples.
   > [Sample PR](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1003/files)
1. Follow the subsection below on [linting](#linting).
1. Follow the subsection below on [bundling](#bundling).
1. Follow the subsection below on [testing](#tests).
1. Clean up old files--webpack config, gulpfile, eslintrc, test/runTest, test/index, etc.
1. Clean up old scripts in package.json.

# Linting
> Samples: [Enabling linting](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1004/files), [Auto fix](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1005/files), [Manual fix](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1006/files)
1. Create an eslint.config.mjs file at the root, and update the lint script. Read more [here](./src/eslint/README.md).
1. Fix lint issues as needed. You can do `npm run lint -- --fix` and it will auto-fix everything it can. I suggest
   committing auto-fixed issues separately from manually-fixed, so it's easier to read the PRs.

# Bundling
Extensions must be bundled to improve loading performance and VSIX size. We use esbuild for bundling.

> [Sample PR](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1007/files)
1. Create an esbuild.mjs file at the root. Read more [here](./src/esbuild/README.md).
1. Very, very closely examine your existing webpack.config.js. Typically it is going to have zero or more things you
   will need to migrate to your esbuild config.
    1. The first thing to do is entrypoints. These are a list of bundle files that get created. For example, in the
       Container Tools extension, there is an entrypoint for the extension itself plus one for each language server.
    1. The next thing to look at is any additional files that are being copied to the output. You will need to use
       `esbuild-copy-plugin` to move those. See an example [here](./src/esbuild/esbuildConfigs.ts).
    1. The next thing is to look at the externals. These are things you are telling esbuild to *not* bundle. For example,
       the `vscode` module is provided by VS Code itself, and no attempt should be made to bundle it--so it is by default
       an external. **NOTE:** A lot of the time, the externals are no longer needed. Do your research on why it was
       added, and determine if it is still needed. There is no easy way around this.
1. Very, very closely examine your gulpfile.ts. Similar to the previous step, you need to understand what is being done,
   whether it still needs to be done, and then you must migrate accordingly.
1. Replace your NPM build script to build the bundle *and* type check with `--noEmit`. Again, go see
   [Container Tools](https://github.com/microsoft/vscode-containers/blob/main/package.json) for an example.
1. Build your VSIX. Unzip it and compare contents to the previous version--aside from differences in code-splitting,
   it should have exactly the same contents as before, minus anything you expected to disappear.

# Tests
Depending on how your tests run, you will do one of the below.

## Mocha Tests
Your tests run directly in Mocha, because **you do not have VS Code dependencies**.

1. Remove any scripts or tasks that are used to build the tests. Use just `"test": "mocha"` as your test script.
1. Add the following to your package.json, at the root (sub in your actual test location):
    ```jsonc
        "mocha": {
            "ui": "tdd", // Only if your tests use `suite()`, `test()`, etc.
            "node-option": [
                "import=tsx"
            ],
            "spec": [
                "src/test/**/*.test.ts"
            ]
        }
    ```
1. Optionally, you can choose a grep to select specific tests. All mocha options are supported here.
1. Add in your launch config. It will look something like this:
    ```json
        {
            "name": "Launch tests",
            "request": "launch",
            "runtimeArgs": [
                "test",
            ],
            "runtimeExecutable": "npm",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "type": "node"
        },
    ```

## VS Code Tests
Your tests run in the VS Code extension test host, because **you do have VS Code dependencies**.
> Samples: [Enabling testing](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1008/files), [Fixing imports](https://github.com/microsoft/vscode-azurestaticwebapps/pull/1009/files)

1. Remove extension.bundle.ts. This will break loads of imports in the test code. Fix those by importing directly from src.
    > **NOTE:** Because the extension is running from the bundle and the tests are running directly in TSX, that means
    > anything the tests import from the src is a *copy* at runtime--not the same as what the extension has loaded.
    > In practice, this means things like extension state cannot be accessed or manipulated. A very common example
    > of that is `extensionVariables`, which will not work.
    >
    > Instead, imagine that the tests are another extension within the extension host. You can import some of the same things,
    > but you get a copy, not the original. You can also use the VS Code APIs to interact with your extension.
    >
    > See the following for what can be imported from src:
    >   - ✔️ Simple functions
    >   - ✔️ Types
    >   - ✔️ Enums
    >   - ✔️ Constants
    >   - ❔ Classes--depends on how they are implemented
    >   - ❌ Variables or other state you expect to be shared
    >
    > To migrate, you may have to rewrite the tests to be more like unit tests, or otherwise, export the necessary
    > objects from the extension API *but only when running tests*. You can test the `VSCODE_RUNNING_TESTS` env var,
    > which is set in the base test config.
1. Also fix other imports as needed.
1. Create a .vscode-test.mjs file at the root. Read more [here](./src/vscode-test/README.md).
1. Run the tests. Take note of how many are running, and make sure it's the same as before.

# Migrating an extension to ESM
Only do this if you wish to also migrate your extension to ESM. This allows ESBuild to do code splitting,
which can improve load times by deferring package loading until it is necessary.
> [Sample PR](https://github.com/microsoft/vscode-containers/pull/373/files)

1. First do all of the above
1. Update to at least v1.0.0-alpha.12 of this package (but prefer the latest alpha).
1. Rename your `main.js` to `main.mjs`, and change it according to the above sample PR. It will primarily have just an
   `await import` of the bundle, an `activate()`, and a `deactivate()`.
1. Add a `module` field to `package.json`, referencing your `main.mjs`, and update `main` as well to reference the same.
1. In `esbuild.mjs`, pass `true` to `autoSelectEsbuildConfig()`.
1. There may be other things that need to change--for example, the Container Tools extension launches the language servers
   in a separate process. The file extension changed for those. This is visible in the sample above in the changes to `extension.ts`.
