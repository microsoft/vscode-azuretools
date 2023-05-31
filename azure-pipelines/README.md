## Usage

To use these base pipeline templates:
1. Your project must have an `.nvmrc` file with the appropriate Node.js version at the root of the repository
1. Your `package.json` file must contain the following NPM scripts:
    1. `build`: this should get the code built sufficiently that it is testable. Note, for a VSCode extension, this should include bundling (webpack, esbuild).
    1. `package`: this should do whatever packaging is needed of the built code--e.g. into a .vsix, .tgz, etc. The resulting package files will be published as build artifacts. This will always run after the `build` script, so it is not necessary to have a prepack script.
    1. `test`: this should run the tests. This will always run after the `build` script, so it is not necessary to have a pretest script.
1. Create a `.azure-pipelines` folder at the root of the repository
1. Copy `compliance/CredScanSuppressions.json`, and `compliance/PoliCheckExclusions.xml` into `.azure-pipelines/compliance`, structured as such:
```
<RepositoryRoot>
    .azure-pipelines
        compliance
            CredScanSuppressions.json
            PoliCheckExclusions.xml
```
5. Create a `main.yml` file in `.azure-pipelines` with the following contents:

```yaml
# Trigger the build whenever `main` is updated
trigger:
  - main
  - rel/*

# Scheduled nightly build
schedules:
  - cron: "0 0 * * *"
    displayName: Nightly scheduled build
    always: false # Don't rebuild if there haven't been changes
    branches:
      include:
        - main

# Grab the base templates from https://github.com/microsoft/vscode-azuretools
resources:
  repositories:
    - repository: templates
      type: github
      name: microsoft/vscode-azuretools
      ref: main
      endpoint: GitHub

# Use those templates
extends:
  template: azure-pipelines/jobs.yml@templates
```
