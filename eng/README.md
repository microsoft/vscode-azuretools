# Shared Engineering Package for Azure Visual Studio Code Extensions

This package provides shared engineering dependencies for the Azure extensions for Visual Studio Code.

In addition, universal and recommended configurations are provided. They can be overridden as needed by the projects.

# Contents

- [ESBuild Config](./src/esbuild/README.md)
- [ESLint Config](./src/eslint/README.md)
- [VS Code Test Config](./src/vscode-test/README.md)
- [Standalone Node/Mocha Config](./src/mocha/README.md)

# TypeScript Compilers

This package supplies native TypeScript 7 as the `@typescript/native` dependency
for consumer builds and type checking. TypeScript 6 remains installed as
`typescript` for the compiler API required by typescript-eslint.

Use eng's `tsgo` command rather than bare `tsc`, since both compiler packages provide
`tsc`. `tsgo` selects the native compiler without requiring consumer hoisting.
See the [build, watch, and typecheck examples](./MIGRATION.md#typescript-compilers).

# Tests

Using Node.js 22.17.0 or later, run the following from `eng`:

```sh
npm run build
npm test
```

Build first because the tests exercise the package's public exports.

# TODO: Future Ideas

- Common/base `.vscode/` items, e.g. `.vscode/extensions.json`, `.vscode/launch.json`, etc.
  - These could be just reference items that consumers can copy into their own projects, or if we want to get fancy, we could do it on install.
- Common/base `tsconfig.json` items
- Common/base ignores, e.g. `.npmignore`, `.vscodeignore`
  - These could be just reference items that consumers can copy into their own projects, or if we want to get fancy, we could do it on install.

# TODONT: Things Not to Do

- Don't put `@types/vscode` or a `vscode` engine version into this package--that should remain up to the consuming extensions.
- Don't put `@types/node` into this package--that should remain up to the consuming extensions.

# License

[MIT](LICENSE.md)
