# Signing Template System Implementation

## Overview

A flexible signing template system has been implemented that allows you to:
- Choose between multiple signing templates when queueing a build
- Maintain default signing templates in the repository
- Easily add custom signing templates

## What Was Changed

### 1. New Directory: `azure-pipelines/templates/signing/`

Contains the actual signing template implementations:

- **`signproj.yml`**: Uses the legacy `SignExtension.signproj` MSBuild approach
- **`microbuild.yml`**: Uses MicroBuild signing infrastructure (1ES recommended)
- **`README.md`**: Documentation for the signing system

### 2. Updated: `azure-pipelines/1esmain.yml`

Added the `signingTemplate` parameter:

```yaml
  - name: signingTemplate
    type: string
    default: 'signproj'
    values:
      - 'signproj'
      - 'microbuild'
```

This parameter:
- Defaults to `'signproj'` for backward compatibility
- Restricts choices to the two available templates
- Gets passed through to `1esstages.yml`

### 3. Updated: `azure-pipelines/1esstages.yml`

- Added `signingTemplate` parameter (string, defaults to `'signproj'`)
- Passes `signingTemplate` to `templates/sign.yml`

### 4. Updated: `azure-pipelines/templates/sign.yml`

Simplified to conditionally route to the appropriate signing template:

```yaml
steps:
  - ${{ if eq(parameters.signingTemplate, 'signproj') }}:
    - template: ./signing/signproj.yml
      parameters:
        vsixFileNames: ${{ parameters.vsixFileNames }}

  - ${{ if eq(parameters.signingTemplate, 'microbuild') }}:
    - template: ./signing/microbuild.yml
      parameters:
        vsixFileNames: ${{ parameters.vsixFileNames }}
```

## How to Use

### When Queueing a Build

**Option 1: Use the default (signproj)**
- Just queue the build normally - it will use `signproj` by default

**Option 2: Explicitly choose a template**
- Queue the build with parameters:
  ```
  signingTemplate: 'microbuild'
  ```

### In Azure Pipelines UI

When queueing a build, you'll see the `signingTemplate` parameter with dropdown choices:
- `signproj` (default)
- `microbuild`

## Adding New Signing Templates

To add a new custom signing template:

1. Create `azure-pipelines/templates/signing/mytemplate.yml`
2. Implement your signing steps
3. Add `'mytemplate'` to the `values` list in `1esmain.yml`:
   ```yaml
   values:
     - 'signproj'
     - 'microbuild'
     - 'mytemplate'  # Add your template here
   ```
4. Add a conditional in `templates/sign.yml`:
   ```yaml
   - ${{ if eq(parameters.signingTemplate, 'mytemplate') }}:
     - template: ./signing/mytemplate.yml
       parameters:
         vsixFileNames: ${{ parameters.vsixFileNames }}
   ```

## Architecture Flow

```
1esmain.yml (entry point)
    ↓
    passes signingTemplate to ↓
1esstages.yml (stages orchestrator)
    ↓
    passes signingTemplate to ↓
templates/sign.yml (router)
    ↓
    conditionally includes ↓
templates/signing/{signproj,microbuild}.yml (actual implementation)
```

## Backward Compatibility

✅ Fully backward compatible:
- Default template is `'signproj'` which contains the original signing logic
- Existing builds will continue to work without any parameter changes
- All existing functionality is preserved
