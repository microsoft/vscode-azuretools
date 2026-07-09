# Shared Engineering Package for Azure Visual Studio Code Extensions

This package provides shared engineering dependencies for the Azure extensions for Visual Studio Code.

In addition, universal and recommended configurations are provided. They can be overridden as needed by the projects.

# Contents

- [ESBuild Config](./src/esbuild/README.md)
- [ESLint Config](./src/eslint/README.md)
- [VS Code Test Config](./src/vscode-test/README.md)
- [Internal Feed Auth Scripts](#internal-feed-auth-scripts)

# Internal Feed Auth Scripts

Two scripts are provided to authenticate the internal `@microsoft`-scoped Azure Artifacts feed (`azcode`) using `@microsoft/artifacts-npm-credprovider` with self-describing (Entra) tokens.

Both scripts:
1. Install `@microsoft/artifacts-npm-credprovider` globally (unconditionally, to always pick up the latest version).
2. Point the `@microsoft` npm scope at the internal `azcode` feed.
3. Run the credential provider, forwarding any extra arguments.

## `scripts/internalFeedAuth.ps1` (PowerShell Core)

Use this script on Windows or wherever PowerShell Core (`pwsh`) is available.

**Example usage:**

```powershell
# Validate credentials only
pwsh -File ./node_modules/@microsoft/vscode-azext-eng/scripts/internalFeedAuth.ps1 --validate-only

# Force re-authentication
pwsh -File ./node_modules/@microsoft/vscode-azext-eng/scripts/internalFeedAuth.ps1 --force
```

## `scripts/internalFeedAuth.sh` (POSIX shell)

Use this script on Linux, macOS, or any POSIX-compatible shell environment.

**Example usage:**

```sh
# Validate credentials only
./node_modules/@microsoft/vscode-azext-eng/scripts/internalFeedAuth.sh --validate-only

# Force re-authentication
./node_modules/@microsoft/vscode-azext-eng/scripts/internalFeedAuth.sh --force
```

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
