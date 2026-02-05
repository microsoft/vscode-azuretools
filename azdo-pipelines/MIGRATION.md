# Migrating from v1 Pipeline Templates

Migration to the new templates is very easy.

1. Move your build and release pipelines from `.azure-pipelines` to `.config`. Also move `tsaoptions.json`.
2. Delete the deprecated `.azure-pipelines/compliance/CredScanSuppressions.json`, `.azure-pipelines/compliance/PoliCheckExclusions.xml`, and `.azure-pipelines/SignExtension.signproj`.
3. Rewrite your build pipeline as needed, following the examples in the [README](./README.md#example).
4. Rewrite your release pipeline as needed, following the examples in the README for [extensions](./README.md#example-1) or [npm](./README.md#example-2).
5. Ensure your `.vscodeignore` or `.npmignore` is ignoring the new `.config` folder.
6. In Azure DevOps, update your [pipelines](https://devdiv.visualstudio.com/DevDiv/_build?definitionScope=%5CAzure%20Tools%5CVSCode) to point to the new pipeline files in `.config`. This can be done in the pipeline settings, and does not require the "DevDiv Edit Pipelines" entitlement.

Example PRs:
- Extension: https://github.com/microsoft/vscode-containers/pull/365
- NPM packages: https://github.com/microsoft/vscode-docker-extensibility/pull/334
