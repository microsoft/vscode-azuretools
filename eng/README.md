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
Tests live in `test/`, next to `src/`, and are type-checked without emitting test
JavaScript during `npm run build`. CI builds first; local runs also need distributable
outputs for package-entry-point and declaration integration checks, and to preload
the shared Mocha resolve hook. Imports retain JavaScript extensions; the hook resolves
missing relative `.js`/`.mjs`/`.cjs` paths to TypeScript sources during native execution.
The harness reuses that hook but keeps its own assertion setup; the shared Mocha preset
is exercised separately by an integration fixture. `should` registration is local to
this harness; the shared test globals continue to provide `expect` without modifying
`Object.prototype`.

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
