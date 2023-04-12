## Usage

To use these base pipeline templates:
1. Your project must be buildable with Node.js 16
1. Your `package.json` file must contain the following NPM scripts:
    1. `build`: this should get the code built sufficiently that it is testable
    1. `test`: this should run the tests
    1. `package`: this should do whatever packaging is needed of the built code--e.g. into a .vsix, .tar.gz, etc. The resulting package files will be published as build artifacts.
1. Create an `.azure-pipelines` folder at the root of the repository
1. Copy `linux/xvfb.init`, `compliance/CredScanSuppressions.json`, and `compliance/PoliCheckExclusions.xml` into that folder, in their respective subfolders, structured as such:
```
<RepositoryRoot>
    .azure-pipelines
        compliance
            CredScanSuppressions.json
            PoliCheckExclusions.xml
        linux
            xvfb.init
```
3. Create a `main.yml` file in `.azure-pipelines` with the following contents:

```yaml
# Trigger the build whenever `main` is updated
trigger:
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
  template: azure-pipelines/main.yml@templates
```
