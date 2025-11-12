# Shared Engineering Package for Azure Visual Studio Code Extensions

This package provides shared engineering dependencies for the Azure extensions for Visual Studio Code.

In addition, universal and recommended configurations are provided. They can be overridden as needed by the projects.

# Contents

- [ESBuild Config](./src/esbuild/README.md)
- [ESLint Config](./src/eslint/README.md)
- [VS Code Test Config](./src/vscode-test/README.md)

# TODO: Future Ideas

- Common/base `.vscode/` items, e.g. `.vscode/extensions.json`, `.vscode/launch.json`, etc.
  - These could be just reference items that consumers can copy into their own projects, or if we want to get fancy, we could do it on install.
- Common/base `tsconfig.json` items
- Common/base ignores, e.g. `.npmignore`, `.vscodeignore`
  - These could be just reference items that consumers can copy into their own projects, or if we want to get fancy, we could do it on install.
- Use `tsgo` (TypeScript native) instead of `tsc`. Correspondingly, use native language server.

# TODONT: Things Not to Do

- Don't put `@types/vscode` or a `vscode` engine version into this package--that should remain up to the consuming extensions.
- Don't put `@types/node` into this package--that should remain up to the consuming extensions.

# License

[MIT](LICENSE.md)
