# Shared Engineering Package for Azure Visual Studio Code Extensions

This package provides shared engineering dependencies for the Azure extensions for Visual Studio Code.

In addition, universal and recommended configuration is provided. It can be overridden as needed by the projects.

# Contents

- [ESBuild Config](./src/esbuild/README.md)
- [ESLint Config](./src/eslint/README.md)
- [Test Config](./src/vscode-test/README.md)
- [Webpack Config](./src/webpack/README.md)

# TODO: Future Ideas

- Common/base `.vscode/` items, e.g. `.vscode/extensions.json`, `.vscode/launch.json`, etc.
  - These could be just reference items that consumers can copy into their own projects, or if we want to get fancy, we could do it on install.
- Common/base `tsconfig.json` items
- Common/base ignores, e.g. `.npmignore`, `.vscodeignore`
  - These could be just reference items that consumers can copy into their own projects, or if we want to get fancy, we could do it on install.

# TODO: Other

- Need to make sure VSCode doesn't get mad about projects referencing dependencies that are indirectly added by this project. For example, `mocha`/`@types/mocha`.

# Things NOT to do

- Put `@types/vscode` or a `vscode` engine version into this package--that should remain up to the consuming extensions.
- Put `@types/node` into this package--that should remain up to the consuming extensions.

# License

[MIT](LICENSE.md)
