# Signing Templates

This directory contains signing template options for the Azure Pipelines build configuration.

## Available Signing Templates

### 1. `signproj` (Default)
Uses the `SignExtension.signproj` MSBuild project file for signing. This is the legacy signing approach using local MSBuild signing.

**Use when:**
- You have a `SignExtension.signproj` file in `.azure-pipelines/`
- You need direct control over the signing process
- You want to use MSBuild-based signing

**File:** `signproj.yml`

### 2. `microbuild`
Uses MicroBuild's signing infrastructure configured at the job level via `templateContext`. This is the modern 1ES-recommended approach.

**Use when:**
- You're using the MicroBuild signing task
- You want centralized signing configuration through the job context
- You're on the latest 1ES pipeline templates

**File:** `microbuild.yml`

## How to Use

The `signingSteps` parameter accepts a `stepList` of signing steps to execute. By default, it includes the steps from `signproj.yml`.

### Built-in Templates

**Use signproj (default):**
```bash
az pipelines run --branch main
```

**Use microbuild:**
When queuing a build, override `signingSteps` with the microbuild template steps.

### Custom Signing Steps

You can override `signingSteps` with your own custom steps by providing them as a step list parameter when queuing the build. The format follows Azure Pipelines step list syntax.

For complex custom signing, you can create a new template in your repository and reference it through the step list parameter.

## Adding Custom Signing Templates

### Local Templates (in this repository)

To add a new signing template in this directory:

1. Create a new YAML file (e.g., `custom-signer.yml`)
2. Define it with parameters accepting `vsixFileNames`:

```yaml
parameters:
  - name: vsixFileNames
    type: object
    default: ['']

steps:
  # Your signing steps here
```

3. Reference it in `signingSteps` parameter when queuing the build

### External Templates

Create a signing template in your repository and reference it through the `signingSteps` parameter as a step list.

## Configuration

The signing pipeline flow:
1. `1esmain.yml` - Entry point, defines available signing templates
2. `1esstages.yml` - Passes the template choice through stages
3. `templates/sign.yml` - Conditional router that includes the appropriate signing template
4. `templates/signing/*.yml` - Actual signing template implementation
