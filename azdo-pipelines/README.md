# AzDO Pipeline Templates (v2)

This folder contains reusable Azure DevOps pipeline templates for building, testing, signing, and releasing VS Code extensions and NPM packages. These templates are designed to be used with the [1ES MicroBuild pipeline templates](http://aka.ms/1espt).

## Main Templates

There are three main templates available:

| Template                       | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| `1es-mb-main.yml`              | Build, test, and sign extensions/packages      |
| `1es-mb-release-extension.yml` | Release a VS Code extension to the Marketplace |
| `1es-mb-release-npm.yml`       | Release an NPM package via ESRP                |

## Prerequisites

Your project must meet the following requirements to use these templates:

1. An `.nvmrc` file at the root (or working directory) specifying the Node.js version
2. Optionally, an `.npmrc` file at the root (or working directory) for authenticating NPM
3. A `package.json` file with the following scripts (if a script needs to skip, simply use a blank value or `"exit 0"` as the script):
   - `lint` - Lints the code (typically using ESLint)
   - `build` - Builds the code (for VS Code extensions, this should include bundling via webpack/esbuild)
   - `package` - Packages the built code (e.g., into a `.vsix` or `.tgz`). Runs after `build`.
   - `test` - Runs tests. Runs after `build` and `package`.
4. After the `package` script has run, the output must match the required build artifacts (see corresponding release pipeline)
5. (For compliance) A `tsaoptions.json` file in `.config` (see [Compliance Configuration](#compliance-configuration))
6. (Only if using `packageManager: pnpm`) Commit a `pnpm-lock.yaml` and set a `"packageManager"` field in `package.json` (e.g. `"packageManager": "pnpm@11.3.0"`) so the build installs the pinned pnpm version. The build installs with `pnpm ci`, which requires pnpm 11+. See [Using pnpm](#using-pnpm).

## Build Pipeline (`1es-mb-main.yml`)

This template handles building, linting, testing, packaging, and signing your code.

### Parameters

| Parameter                   | Type     | Default                                | Description                                              |
| --------------------------- | -------- | -------------------------------------- | -------------------------------------------------------- |
| `isOfficialBuild`           | boolean  | `true`                                 | Set to `true` for official builds, `false` for PRs       |
| `jobs`                      | object   | `[{ name: Root, working_directory: . }]` | Jobs to run; use to parallelize builds in subdirectories |
| `sdlPool`                   | object   | Windows MicroBuild pool                | Pool for SDL/compliance stage                            |
| `buildPool`                 | object   | Linux Ubuntu 22.04                     | Pool for build stage                                     |
| `signType`                  | string   | `real`                                 | `real`, `test`, or `none` for MicroBuild signing         |
| `alternativeSigningSteps`   | stepList | `[]`                                   | Custom signing steps (disables MicroBuild signing)       |
| `additionalSetupSteps`      | stepList | `[]`                                   | Extra steps to run during setup                          |
| `testARMServiceConnection`  | string   | `""`                                   | ARM service connection for federated credential tests    |
| `packageManager`            | string   | `npm`                                  | Package manager for build/test: `npm` or `pnpm`          |
| `feedBaseUrl`               | string   | `""`                                   | Azure Artifacts feed base URL; routes npm/pnpm installs through the private mirror and injects test feed env vars |

### Example

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

resources:
  repositories:
    # Use the shared templates from microsoft/vscode-azuretools
    - repository: azExtTemplates
      type: github
      name: microsoft/vscode-azuretools
      ref: azext-pt/v1
      endpoint: GitHub-AzureTools # The service connection to use when accessing this repository

variables:
  # Pick up shared AZCode variables
  - template: azdo-pipelines/azcode.variables.yml@azExtTemplates
  # Required for MicroBuild signing and telemetry
  - name: TeamName
    value: "Azure Tools for VS Code" # Note: if `azcode.variables.yml` is in use above, this is not needed

extends:
  template: azdo-pipelines/1es-mb-main.yml@azExtTemplates # Use the main build template
  parameters:
    testARMServiceConnection: ${{ variables.testARMServiceConnection }}
    # packageManager: pnpm # Use pnpm instead of npm (see "Using pnpm" below)
    # feedBaseUrl: ${{ variables.feedBaseUrl }} # Route npm/pnpm installs through a private Azure Artifacts mirror
    # signType: none # For NPM packages, disable signing
```

### Using pnpm

By default the build uses **npm** (`npm ci`, then `npm run <script>`). Set `packageManager: pnpm` to use pnpm instead. The install step is uniform across both — it runs `<packageManager> ci` (note: `pnpm ci` requires pnpm 11+). The same `lint`/`build`/`package`/`test` scripts run either way; only the package manager and pnpm's activation differ.

When `packageManager: pnpm`:

- Commit a `pnpm-lock.yaml` (the build runs `pnpm ci`, which requires pnpm 11+).
- Set a `"packageManager"` field in `package.json` (e.g. `"packageManager": "pnpm@11.3.0"`). The build reads that version and installs exactly it. `pnpm ci` requires pnpm 11+.

The pinned pnpm is bootstrapped with `npm install -g pnpm@<version>` from an anonymous proxy feed (`https://packagefeedproxy.microsoft.io/npm`), which the build agents can reach. This avoids Corepack's downloader, which fetches the pnpm binary from `registry.npmjs.org` *before* any feed auth or `.npmrc` is applied and so fails on agents that can't reach `registry.npmjs.org`. Consumers keep a plain `"packageManager": "pnpm@<version>"` — no URLs or extra configuration. The proxy feed is hardcoded in the template today; it can be parametrized later if a consumer needs a different one.

### Private feed (npm and pnpm)

Builds install from an internal Azure Artifacts feed rather than public npm. `feedBaseUrl` is optional; there are two ways to point at the feed:

- **Check in your own `.npmrc`** (in the working directory, or at the repo root as a fallback) pointing `registry` at your internal feed. The setup step uses it as-is — it doesn't overwrite it, though `npmAuthenticate@0` (below) injects credentials into it. (The setup step only checks that an `.npmrc` exists, so it's your responsibility to point it at an internal registry.)
- **Otherwise**, set `feedBaseUrl` (the base URL of an Azure Artifacts feed, e.g. `https://devdiv.pkgs.visualstudio.com/DevDiv/_packaging/azcode`) and the setup step writes a build-time `.npmrc` pointing `registry` at `<feedBaseUrl>/npm/registry/` with `always-auth=true`.

Either way, when an `.npmrc` is present the setup step runs `npmAuthenticate@0` to inject a token. Both npm and pnpm read `.npmrc`, so both install from the feed. If a repo checks in no `.npmrc` and provides no `feedBaseUrl`, the setup step simply skips registry configuration and authentication — the build environment's network isolation (not a feed guard) is what keeps builds off public npm.

## Extension Release Pipeline (`1es-mb-release-extension.yml`)

This template releases a signed VS Code extension to the Visual Studio Marketplace.

### Parameters

| Parameter                   | Type    | Default      | Description                                        |
| --------------------------- | ------- | ------------ | -------------------------------------------------- |
| `packageToPublish`          | string  | *required*   | Name or filename prefix to match the `.vsix` file  |
| `publishVersion`            | string  | *required*   | Expected version (verified against `package.json`) |
| `dryRun`                    | boolean | `false`      | Skip the actual publish step                       |
| `artifactName`              | string  | `Build Root` | Name of the artifact containing the package        |
| `releaseServiceConnection`  | string  | *required*   | Service connection for VSCE authentication         |
| `releaseApprovalEnvironment`| string  | `""`         | AzDO environment for release approval              |
| `npmFeed`                   | string  | `""`         | Azure Artifacts feed for a private NPM mirror      |
| `releasePool`               | object  | Windows MicroBuild pool | Pool for the release job                |

### Required Build Artifacts

The build pipeline must produce the following artifacts for extension release:

1. `*.vsix` - The packaged extension
2. `package.json` - Used to verify extension name and version
3. `extension.manifest` - Generated with `vsce generate-manifest`
4. `extension.signature.p7s` - The signed manifest

### Example

```yaml
# Only run this pipeline when manually triggered
trigger: none
pr: none

parameters:
  # The version to publish--used for ensuring the expected version is published
  - name: publishVersion
    displayName: Version to publish
    type: string
  # Whether to do a dry run (i.e., not actually publish)
  - name: dryRun
    displayName: Dry run
    type: boolean
    default: false

resources:
  pipelines:
    # Reference the build pipeline to get the artifacts
    - pipeline: build # This must be "build"
      source: \Azure Tools\VSCode\Extensions\vscode-containers # Name of the pipeline that produces the artifacts
  repositories:
    # Use the shared templates from microsoft/vscode-azuretools
    - repository: azExtTemplates
      type: github
      name: microsoft/vscode-azuretools
      ref: azext-pt/v1
      endpoint: GitHub-AzureTools # The service connection to use when accessing this repository

variables:
  # Pick up shared AZCode variables
  - template: azdo-pipelines/azcode.variables.yml@azExtTemplates
  # Required for MicroBuild signing and telemetry
  - name: TeamName
    value: "Azure Tools for VS Code" # Note: if `azcode.variables.yml` is in use above, this is not needed

extends:
  template: azdo-pipelines/1es-mb-release-extension.yml@azExtTemplates # Use the extension release template
  parameters:
    packageToPublish: vscode-containers
    publishVersion: ${{ parameters.publishVersion }}
    dryRun: ${{ parameters.dryRun }}
    releaseServiceConnection: ${{ variables.extensionReleaseServiceConnection }}
    releaseApprovalEnvironment: ${{ variables.extensionReleaseApprovalEnvironment }}
    # npmFeed: MyProject/MyFeed # Use a private NPM mirror from Azure Artifacts
```

## NPM Release Pipeline (`1es-mb-release-npm.yml`)

This template releases an NPM package via ESRP.

### Parameters

| Parameter                    | Type    | Default               | Description                                        |
| ---------------------------- | ------- | --------------------- | -------------------------------------------------- |
| `packageToPublish`           | string  | *required*            | Name or filename prefix to match the `.tgz` file   |
| `publishVersion`             | string  | *required*            | Expected version (verified against `package.json`) |
| `dryRun`                     | boolean | `false`               | Skip the actual publish step                       |
| `artifactName`               | string  | `Build Root`          | Name of the artifact containing the package        |
| `ownerAliases`               | string  | *required*            | Owner aliases for ESRP                             |
| `approverAliases`            | string  | *required*            | Approver aliases for ESRP                          |
| `releasePool`                | object  | Windows MicroBuild pool | Pool for the release job                         |
| `gitHubServiceConnection`    | string  | `""`                  | Service connection for creating GitHub releases    |
| `releaseApprovalEnvironment` | string  | `""`                  | AzDO environment for release approval              |
| `feedBaseUrl`                | string  | `""`                  | Azure Artifacts feed base URL for an internal NPM mirror; when set, the package is also published here after the ESRP publish succeeds (same-org feeds authenticate with the build identity) |

> **Note:** When `feedBaseUrl` is set, authentication to a same-org Azure Artifacts feed is automatic (no service connection needed), but **publish permission is not granted automatically**. The pipeline's build identity must be added to the feed as a **Feed Publisher (Contributor)**; otherwise `npm publish` fails with a `403`. In Azure DevOps, go to **Artifacts → (your feed) → ⚙ Feed settings → Permissions → Add users/groups** and grant **Feed Publisher (Contributor)** to the build service identity that runs the release — typically `{Project} Build Service ({org})` for a project-scoped feed (or `Project Collection Build Service ({org})` if collection-scoped). If you're unsure which identity to grant, the `403` error from a first run names the exact account that was denied.

### Required Build Artifacts

The build pipeline must produce the following artifacts for NPM release:

1. `*.tgz` - The packaged NPM package
2. `package.json` - Used to verify extension name and version

### Example

```yaml
# Only run this pipeline when manually triggered
trigger: none
pr: none

parameters:
  # Choose a package to publish at the time of job creation
  - name: packageToPublish
    displayName: Package to publish
    type: string
    values:
      - microsoft-vscode-processutils
      - microsoft-vscode-container-client
      - microsoft-vscode-docker-registries
      - microsoft-vscode-inproc-mcp
  # The version to publish--used for ensuring the expected version is published
  - name: publishVersion
    displayName: Version to publish
    type: string
  # Whether to do a dry run (i.e., not actually publish)
  - name: dryRun
    displayName: Dry run
    type: boolean
    default: false

resources:
  pipelines:
    # Reference the build pipeline to get the artifacts
    - pipeline: build # This must be "build"
      source: \Azure Tools\VSCode\Packages\vscode-docker-extensibility # Name of the pipeline that produces the artifacts
  repositories:
    # Use the shared templates from microsoft/vscode-azuretools
    - repository: azExtTemplates
      type: github
      name: microsoft/vscode-azuretools
      ref: azext-pt/v1
      endpoint: GitHub-AzureTools # The service connection to use when accessing this repository

variables:
  # Pick up shared AZCode variables
  - template: azdo-pipelines/azcode.variables.yml@azExtTemplates
  # Required for MicroBuild signing and telemetry
  - name: TeamName
    value: "Azure Tools for VS Code" # Note: if `azcode.variables.yml` is in use above, this is not needed

extends:
  template: azdo-pipelines/1es-mb-release-npm.yml@azExtTemplates # Use the NPM release template
  parameters:
    packageToPublish: ${{ parameters.packageToPublish }}
    publishVersion: ${{ parameters.publishVersion }}
    dryRun: ${{ parameters.dryRun }}
    ownerAliases: ${{ variables.npmReleaseOwnerAliases }}
    approverAliases: ${{ variables.npmReleaseApproverAliases }}
    gitHubServiceConnection: ${{ variables.gitHubServiceConnection }}
    releaseApprovalEnvironment: ${{ variables.npmReleaseApprovalEnvironment }}
    # feedBaseUrl: ${{ variables.feedBaseUrl }} # Also publish the package to an internal Azure Artifacts feed
```

## Compliance Configuration

Create a `tsaoptions.json` file in `.config` for [TSA (Trust Services Automation)](http://aka.ms/tsa):

```json
{
    "tsaVersion": "TsaV2",
    "codeBase": "NewOrUpdate",
    "codeBaseName": "your-extension-name",
    "tsaStamp": "DevDiv",
    "notificationAliases": [
        "your-team@microsoft.com"
    ],
    "codebaseAdmins": [
        "REDMOND\\your-security-group"
    ],
    "instanceUrl": "https://devdiv.visualstudio.com",
    "projectName": "DevDiv",
    "areaPath": "DevDiv\\Your Area Path",
    "iterationPath": "DevDiv",
    "allTools": true
}
```

## Multi-Package Builds

To build multiple packages in parallel (e.g., in a monorepo), use the `jobs` parameter:

```yaml
parameters:
  jobs:
    - name: Extension
      working_directory: ./extension
    - name: SDK
      working_directory: ./sdk
```

Each job will produce a separate artifact named `Build <job-name>`.
