## Usage

To use these base workflow templates:
1. Your project must have an `.nvmrc` file with the appropriate Node.js version at the root of the repository
1. Your `package.json` file must contain the following NPM scripts:
    1. `lint`: This should perform linting and fail if the allowable linter errors/warnings is exceeded
    1. `build`: this should get the code built sufficiently that it is testable. Note, for a VSCode extension, this should include bundling (webpack, esbuild).
    1. `package`: this should do whatever packaging is needed of the built code--e.g. into a .vsix, .tgz, etc. The resulting package files will be published as build artifacts. This will always run after the `build` script, so it is not necessary to have a prepack script.
    1. `test`: this should run the tests. This will always run after the `build` script, so it is not necessary to have a pretest script.
1. Create a `.github` folder at the root of the repository
1. Inside it, create a `workflows` folder
1. Create a `main.yml` file in `.github/workflows` with the following contents:

```yaml
name: Node PR Lint, Build and Test

on:
  # Trigger when manually run
  workflow_dispatch:

  # Trigger on pushes to `main` or `rel/*`
  push:
    branches:
      - main
      - rel/*

  # Trigger on pull requests to `main` or `rel/*`
  pull_request:
    branches:
      - main
      - rel/*

jobs:
  Build:
    # Use template from https://github.com/microsoft/vscode-azuretools/tree/main/.github/workflows
    uses: microsoft/vscode-azuretools/.github/workflows/jobs.yml@main
```

## Inputs

The reusable workflow accepts the following inputs:

| Input | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `working_directory` | string | no | `"."` | Directory to run the build/test commands in. |
| `package_manager` | string | no | `"npm"` | Package manager to use. Supported values: `npm` and `pnpm`. Any other value is treated as `npm`. |

### Using PNPM

By default the workflow uses NPM and behaves exactly as it always has. To opt into PNPM, set `package_manager: pnpm`. When PNPM is selected the workflow:

- activates pnpm via Corepack (a plain `run` step) before `actions/setup-node`,
- enables PNPM store caching via `actions/setup-node`,
- installs with `pnpm ci` (which requires pnpm 11+),
- runs your scripts with `pnpm run <script>` and tests with `pnpm test`.

PNPM consumers must:

1. Commit a `pnpm-lock.yaml` at the root of your `working_directory` so `pnpm ci`'s frozen-lockfile install works (the workflow activates pnpm via Corepack and resolves the PNPM cache relative to `working_directory`).
1. Specify the PNPM version. The easiest way is to add a `packageManager` field to your `package.json` (e.g. `"packageManager": "pnpm@11.3.0"`), which Corepack reads automatically. `pnpm ci` requires pnpm 11+.
1. Optionally add an `.npmrc` if you need custom PNPM settings (for example `node-linker` or registry configuration).

Example `main.yml` job that opts into PNPM:

```yaml
jobs:
  Build:
    # Use template from https://github.com/microsoft/vscode-azuretools/tree/main/.github/workflows
    uses: microsoft/vscode-azuretools/.github/workflows/jobs.yml@main
    with:
      package_manager: pnpm
```
