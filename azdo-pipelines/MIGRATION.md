# Migrating from v1 Pipeline Templates

Migration to the new templates is very easy.

1. Move your build and release pipelines from `.azure-pipelines` to `.config`. Also move `tsaoptions.json`.
2. Delete the deprecated `.azure-pipelines/compliance/CredScanSuppressions.json`, `.azure-pipelines/compliance/PoliCheckExclusions.xml`, and `.azure-pipelines/SignExtension.signproj`.
3. Rewrite your build pipeline as needed, following the examples in the [README](./README.md#example).
4. Rewrite your release pipeline as needed, following the examples in the README for [extensions](./README.md#example-1) or [npm](./README.md#example-2).
5. Ensure your `.vscodeignore` or `.npmignore` is ignoring the new `.config` folder.
6. If your build installs dependencies from an internal Azure Artifacts feed, configure the feed following the [Private feed (npm and pnpm)](./README.md#private-feed-npm-and-pnpm) section of the README. Either check in an `.npmrc` pointing at your internal feed, or set the `feedBaseUrl` parameter. To also publish an NPM package to an internal feed, set `feedBaseUrl` on the release pipeline and grant the build identity **Feed Publisher (Contributor)** (see the note under [NPM Release Pipeline](./README.md#example-2)).
7. In Azure DevOps, update your [pipelines](https://devdiv.visualstudio.com/DevDiv/_build?definitionScope=%5CAzure%20Tools%5CVSCode) to point to the new pipeline files in `.config`. This can be done in the pipeline settings, and does not require the "DevDiv Edit Pipelines" entitlement.
8. Important! The release pipeline requires signing approval from an M2. This is needed to pass the "Publish Authorization Check" task, even though the pipeline does no signing. In the pipeline's summary page (e.g. https://devdiv.visualstudio.com/DevDiv/_build?definitionId=25091&_a=summary), click the three-dot icon, and do "Request Signing Approval".

Example PRs:
- Extension: https://github.com/microsoft/vscode-azureresourcegroups/pull/1447
- NPM packages: https://github.com/microsoft/vscode-docker-extensibility/pull/334 (also https://github.com/microsoft/vscode-docker-extensibility/pull/364 and https://github.com/microsoft/vscode-docker-extensibility/pull/365 which address some changes in the templates)
