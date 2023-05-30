## Usage

To use these base workflow templates:
1. Your project must have an `.nvmrc` file with the appropriate Node.js version at the root of the repository
1. Your `package.json` file must contain the following NPM scripts:
    1. `lint`: This should perform linting and fail if the allowable linter errors/warnings is exceeded
    1. `build`: this should get the code built sufficiently that it is testable. Note, for a VSCode extension, this should include bundling (webpack, esbuild).
    1. `test`: this should run the tests. This will always run after the `build` script, so it is not necessary to have a pretest script.
    1. `package`: this should do whatever packaging is needed of the built code--e.g. into a .vsix, .tar.gz, etc. The resulting package files will be published as build artifacts. This will always run after the `build` script, so it is not necessary to have a prepack script.
1. Create a `.github` folder at the root of the repository
1. Inside it, create a `workflows` folder
1. Create a `main.yml` file in `.github/workflows` with the following contents:

```yaml
name: Node PR Lint, Build and Test

on:
  push:
    branches:
      - main
      - rel/*
  pull_request:
    branches:
      - main
      - rel/*

jobs:
  Build:
    uses: microsoft/vscode-azuretools/.github/workflows/jobs.yml@main
```
