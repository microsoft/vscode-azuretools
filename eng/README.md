# Shared Engineering Package for Azure Visual Studio Code Extensions

This package provides shared engineering dependencies for the Azure extensions for Visual Studio Code.

In addition, universal and recommended configurations are provided. They can be overridden as needed by the projects.

# Contents

- [ESBuild Config](./src/esbuild/README.md)
- [ESLint Config](./src/eslint/README.md)
- [VS Code Test Config](./src/vscode-test/README.md)
- [Standalone Node/Mocha Config](./src/mocha/README.md)

# TypeScript Compilers

The ESLint configurations use TypeScript 6's compiler API. This package builds with
native TypeScript 7, installed separately as the `@typescript/native` alias. Build
scripts invoke that compiler explicitly because both packages provide a `tsc` binary.
Consumers can opt into the same arrangement; see [migration guidance](./MIGRATION.md#typescript-compilers).

# Tests

Requires Node.js 22.17.0 or later. From `eng`, run `npm run build` before `npm test` to
execute the ESM TypeScript test sources directly with Mocha, Node's built-in type
stripping, Chai `should`, and chai-as-promised. Mocha options are configured in
`package.json`: `experimental-strip-types` enables source execution on Node 22,
and `disable-warning=ExperimentalWarning` suppresses experimental warnings without
suppressing other warning categories. No tsx or compiled test runner is used.
Tests live in `test/`, next to `src/`, and share one TypeScript project. Builds check
both directories and emit them under `dist/esm` and `dist/cjs`; emitted tests are
excluded from the published package. Tests import the built package's public exports.
Mocha preloads the local TypeScript assertion setup directly, without a source-resolution hook.
The shared Mocha preset is exercised separately by an integration fixture and continues
to provide global `expect` without modifying `Object.prototype`.

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
