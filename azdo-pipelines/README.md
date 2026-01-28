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
3. A `package.json` file with the following NPM scripts (if a script needs to skip, simply use a blank value or `"exit 0"` as the script):
   - `lint` - Lints the code (typically using ESLint)
   - `build` - Builds the code (for VS Code extensions, this should include bundling via webpack/esbuild)
   - `package` - Packages the built code (e.g., into a `.vsix` or `.tgz`). Runs after `build`.
   - `test` - Runs tests. Runs after `build` and `package`.
4. After the `package` script has run, the output must match the required build artifacts (see corresponding release pipeline)
5. (For compliance) A `tsaoptions.json` file in `.config` (see [Compliance Configuration](#compliance-configuration))

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

### Example

```yaml
# TODO: Paste your example here
```

## Extension Release Pipeline (`1es-mb-release-extension.yml`)

This template releases a signed VS Code extension to the Visual Studio Marketplace.

### Parameters

| Parameter                          | Type    | Default      | Description                                        |
| ---------------------------------- | ------- | ------------ | -------------------------------------------------- |
| `packageToPublish`                 | string  | *required*   | Regex pattern to match the `.vsix` file            |
| `publishVersion`                   | string  | *required*   | Expected version (verified against `package.json`) |
| `dryRun`                           | boolean | `false`      | Skip the actual publish step                       |
| `artifactName`                     | string  | `Build Root` | Name of the artifact containing the package        |
| `extensionReleaseServiceConnection`| string  | *required*   | Service connection for VSCE authentication         |
| `releaseApprovalEnvironment`       | string  | `""`         | AzDO environment for release approval              |
| `releasePool`                      | object  | Windows MicroBuild pool | Pool for the release job                |

### Required Build Artifacts

The build pipeline must produce the following artifacts for extension release:

1. `*.vsix` - The packaged extension
2. `package.json` - Used to verify extension name and version
3. `extension.manifest` - Generated with `vsce generate-manifest`
4. `extension.signature.p7s` - The signed manifest

### Example

```yaml
# TODO: Paste your example here
```

## NPM Release Pipeline (`1es-mb-release-npm.yml`)

This template releases an NPM package via ESRP.

### Parameters

| Parameter                    | Type    | Default               | Description                                        |
| ---------------------------- | ------- | --------------------- | -------------------------------------------------- |
| `packageToPublish`           | string  | *required*            | Regex pattern to match the `.tgz` file             |
| `publishVersion`             | string  | *required*            | Expected version (verified against `package.json`) |
| `dryRun`                     | boolean | `false`               | Skip the actual publish step                       |
| `artifactName`               | string  | `Build Root`          | Name of the artifact containing the package        |
| `ownerAliases`               | string  | *required*            | Owner aliases for ESRP                             |
| `approverAliases`            | string  | *required*            | Approver aliases for ESRP                          |
| `releasePool`                | object  | Windows MicroBuild pool | Pool for the release job                         |
| `gitHubServiceConnection`    | string  | `""`                  | Service connection for creating GitHub releases    |
| `releaseApprovalEnvironment` | string  | `""`                  | AzDO environment for release approval              |

### Required Build Artifacts

The build pipeline must produce the following artifacts for extension release:

1. `*.tgz` - The packaged NPM package
2. `package.json` - Used to verify extension name and version

### Example

```yaml
# TODO: Paste your example here
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
