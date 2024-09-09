## Usage

### 1ES pipelines
To use these base pipeline templates:
1. Your project must have an `.nvmrc` file with the appropriate Node.js version at the root of the repository
1. Your `package.json` file must contain the following NPM scripts:
    1. `build`: this should get the code built sufficiently that it is testable. Note, for a VSCode extension, this should include bundling (webpack, esbuild).
    1. `package`: this should do whatever packaging is needed of the built code--e.g. into a .vsix, .tgz, etc. The resulting package files will be published as build artifacts. This will always run after the `build` script, so it is not necessary to have a prepack script.
    1. `test`: this should run the tests. This will always run after the `build` script, so it is not necessary to have a pretest script.
1. Create a `.azure-pipelines` folder at the root of the repository
1. Copy `compliance/CredScanSuppressions.json` into `.azure-pipelines/compliance`, structured as such:
```
<RepositoryRoot>
    .azure-pipelines
        compliance
            CredScanSuppressions.json
```
5. Create a `1esmain.yml` file in `.azure-pipelines` with the following contents:

```yaml
# Trigger the build whenever `main` or `rel/*` is updated
trigger:
  - main
  - rel/*

# Disable PR trigger
pr: none

# Scheduled nightly build of `main`
schedules:
  - cron: "0 0 * * *"
    displayName: Nightly scheduled build
    always: false # Don't rebuild if there haven't been changes
    branches:
      include:
        - main

# `resources` specifies the location of templates to pick up, use it to get AzExt templates
resources:
  repositories:
    - repository: azExtTemplates
      type: github
      name: microsoft/vscode-azuretools
      ref: main
      endpoint: GitHub-AzureTools # The service connection to use when accessing this repository

parameters:
  - name: enableLongRunningTests
    displayName: Enable Long Running Tests
    type: boolean
    default: true

variables:
  # Required by MicroBuild template
  - name: TeamName
    value: "Azure Tools for VS Code"

# Use those templates
extends:
  template: azure-pipelines/1esmain.yml@azExtTemplates
  parameters:
    useAzureFederatedCredentials: ${{ parameters.enableLongRunningTests }}
```

6. To enable extension signing, add a `SignExtension.signproj` file in the `.azure-pipelines` folder with the following contents:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="Current" Sdk="Microsoft.Build.NoTargets/3.7.56">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <!-- FilesToSign needs to be inside $(OutDir) hence we copy it into
    $(OutDir) before (from CWD) and move it back outside after the signing -->
    <FilesToSign Include="$(OutDir)\extension.signature.p7s">
      <!-- Add the certificate friendly name below -->
      <Authenticode>VSCodePublisher</Authenticode>
    </FilesToSign>
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.VisualStudioEng.MicroBuild.Core" Version="1.0.0">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
  </ItemGroup>

  <Target Name="CopySignatureFile" BeforeTargets="SignFiles">
    <Copy SourceFiles="$(ProjectDir)\..\extension.manifest" DestinationFiles="$(OutDir)\extension.signature.p7s" />
  </Target>

  <Target Name="CopyBackSignatureFile" AfterTargets="SignFiles">
    <Copy SourceFiles="$(OutDir)\extension.signature.p7s" DestinationFiles="$(ProjectDir)\..\extension.signature.p7s" />
  </Target>
</Project>
```

### Extension release pipeline

This pipeline downloads and releases signed VSIX artifacts from the specified build pipeline.

Some safety features have been added to this pipeline to prevent accidental releases:
1. Releases will require approval from an environment. The environment can be specified and every environment can have a different group of members that can approve releases. Self approval can be enabled/disabled.
2. A version string is required at pipeline run time that will be matched against the version present in the package.json downloaded from the build pipeline artifacts.
3. Added a "Dry Run" parameter that when set will skip the last step that actually publishes the extension.

The build pipeline needs to upload the following artifacts for this pipeline to work:
1. extension.vsix (name can vary, pipeline looks for a single *.vsix file)
2. package.json (needed to verify the extension name and version when publishing)
3. extension.manifest (created with `vsce generate-manifest`)
4. extension.signature.p7s (result of signing the manifest)

Use and modify the following YAML file to use the extension release pipeline template. Make sure to replace the `source` field with the name of the pipeline that produces the artifacts you want to release. Lines that should/could be customized will be marked with `# CUSTOMIZE`.

```yaml
trigger: none

parameters:
  - name: publishVersion
    displayName: Version to publish
    type: string
  - name: dryRun
    displayName: Dry run
    type: boolean
    default: false

resources:
  pipelines:
    - pipeline: build
      source: \Azure Tools\VSCode\Extensions\vscode-azurecontainerapps # CUSTOMIZE - location of the pipeline that produces the artifacts
  repositories:
    - repository: azExtTemplates
      type: github
      name: microsoft/vscode-azuretools
      ref: main
      endpoint: GitHub-AzureTools

variables:
  # Required by MicroBuild template
  - name: TeamName
    value: "Azure Tools for VS Code" # CUSTOMIZE

# Use those templates
extends:
  template: azure-pipelines/release-extension.yml@azExtTemplates
  parameters:
    pipelineID: $(resources.pipeline.build.pipelineID)
    runID: $(resources.pipeline.build.runID)
    publishVersion: ${{ parameters.publishVersion }}
    dryRun: ${{ parameters.dryRun }}
    environmentName: AzCodeDeploy # CUSTOMIZE
```

The extension release pipeline has the following parameters.

```yaml
# pipelineID and runID are used to download the artifacts from a specific build pipeline
- name: pipelineID
  type: string
- name: runID
  type: string

# Customize the environment to associate the deployment with. 
# Useful to control which group of people should be required to approve the deployment.
- name: environmentName
  type: string
  default: AzCodeDeploy

# The following parameters are meant to be provded by the user when initiating a pipeline run

# The intended extension version to publish. 
# This is used to verify the version in package.json matches the version to publish to avoid accidental publishing.
- name: publishVersion
  type: string

  # When true, skips the deployment job which actually publishes the extension
- name: dryRun
  type: boolean
  default: false
```

### (DEPRECATED) Primary pipelines

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
# Trigger the build whenever `main` or `rel/*` is updated
trigger:
  - main
  - rel/*

# Disable PR trigger
pr: none

# Scheduled nightly build
schedules:
  - cron: "0 0 * * *"
    displayName: Nightly scheduled build
    always: false # Don't rebuild if there haven't been changes
    branches:
      include:
        - main

# Grab the base templates from https://github.com/microsoft/vscode-azuretools/tree/main/azure-pipelines
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

### (DEPRECATED) Releasing to NPM

1. Releasing to NPM requires only a simple YAML pipeline file, for example this `release-npm.yml` file in `.azure-pipelines`:

```yaml
trigger: none # Disable the branch trigger
pr: none # Disable PR trigger

# Choose a package to publish at the time of job creation
parameters:
  - name: PackageToPublish
    displayName: Package to Publish
    type: string
    values:
      - microsoft-vscode-container-client
      - microsoft-vscode-docker-registries
      - your-packages-here

# Grab the base templates from https://github.com/microsoft/vscode-azuretools/tree/main/azure-pipelines
resources:
  repositories:
    - repository: templates
      type: github
      name: microsoft/vscode-azuretools
      ref: main
      endpoint: GitHub

# Use those base templates
extends:
  template: azure-pipelines/release-npm.yml@templates
  parameters:
    PackageToPublish: ${{ parameters.PackageToPublish }}
    PipelineDefinition: 33

```
2. Running the pipeline will release the package to NPM and create a draft GitHub release. Add change notes to the draft release and publish when complete.
