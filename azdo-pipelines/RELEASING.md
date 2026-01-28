# Releasing New Pipeline Templates

Because consumers of these pipeline templates typically do not reference `main` directly, changes merged into `main` are not automatically deployed to consumers. We use release branches for this, for example `azext-pt/v1`.

If at all possible, avoid breaking changes. If breaking changes are necessary, it is strongly suggested to add a step to the prior version that shows a warning to consumers that the version is deprecated and should be updated as soon as possible.

## Releasing

Use the [Release Pipeline Templates](https://github.com/microsoft/vscode-azuretools/actions/workflows/release-pipeline-templates.yml) workflow to update or create release branches.

1. Go to the workflow and click "Run workflow"
2. Enter the branch name (e.g., `azext-pt/v1` for updates, `azext-pt/v2` to create a new branch for breaking changes)
3. Click "Run workflow"
4. If updating an existing branch, a PR will be created--review and merge it

The release branches are protected by branch protection rules, requiring a PR to update them.
