# Universal steps
1. In package.json, remove dev dependencies that are covered by this package. This includes everything related to
   linting (eslint), bundling (webpack/esbuild), testing (mocha, chai, VS Code testing), and publish (vsce). Remove
   typescript as well.
1. Spend some time validating the remaining dependencies (dev and real), to see if they are actually in use.
1. Run `npm i`. Briefly revel in your much-smaller package-lock.json.
1. Run `npm i --save-dev @microsoft/vscode-azext-eng` to install the latest eng package. Bye bye small package-lock.json.
1. Update your .nvmrc to Node 22+, and update `@types/node` accordingly. The minimum VS Code version for Node 22 is 1.101.0.
   As appropriate, add a minimum VS Code engine version to your package.json as well.
1. If needed, update `@microsoft/vscode-azext-utils` to 4.0.1 to get the replacements for TestUserInput, TestActionContext, etc.

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
1. Update your tsconfig.json to use target=es2022, lib=es2022, module=nodenext, moduleResolution=nodenext.
1. Rewrite main.js at the root, it will look more like [this](https://github.com/microsoft/vscode-containers/blob/main/main.js).
   You no longer use an environment variable to switch between loading the bundled or unbundled code--there is only the bundle.
1. Rewrite files in the .vscode folder. See [Container Tools](https://github.com/microsoft/vscode-containers/tree/main/.vscode)
   for examples.
1. Follow the subsection below on [linting](#linting).
1. Follow the subsection below on [bundling](#bundling).
1. Follow the subsection below on [testing](#tests).
1. Clean up old files--webpack config, gulpfile, eslintrc, test/runTest, test/index, etc.
1. Clean up old scripts in package.json.

# Linting
1. Create an eslint.config.mjs file at the root, and update the lint script. Read more [here](./src/eslint/README.md).
1. Fix lint issues as needed.

# Bundling
Extensions must be bundled to improve loading performance and VSIX size. You can use esbuild or Webpack for bundling.

## ESBuild
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
1. Build your VSIX. Unzip it and compare contents to the previous version--aside from splitting, it should have exactly
   the same contents as before, minus anything you expected to disappear.

## Webpack
I'm not even gonna write a guide for bundling with Webpack 'cause nobody likes it lol.

# Tests
Depending on how your tests run, you will do one of the below.

## Mocha Tests
Your tests run directly in Mocha, because **you do not have VS Code dependencies**.
WIP

## VS Code Tests
Your tests run in the VS Code extension test host, because **you do have VS Code dependencies**.

1. Remove extension.bundle.ts. This will break loads of imports in the test code. Fix those by importing directly from src.
1. Also fix other imports as needed.
1. Create a .vscode-test.mjs file at the root. Read more [here](./src/vscode-test/README.md).
1. Run the tests. Take note of how many are running, and make sure it's the same as before.
