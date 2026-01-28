# Releasing New Pipeline Templates

Because consumers of these pipeline templates typically do not reference `main` directly, changes merged into `main` are not automatically deployed to consumers. We use Git tags for this, for example `azext-pt/v1`.

If at all possible, avoid breaking changes.

## Releasing

Use the [Release Pipeline Templates](https://github.com/microsoft/vscode-azuretools/actions/workflows/release-pipeline-templates.yml) workflow to update or create tags.

1. Go to the workflow and click "Run workflow"
2. Enter the tag name (e.g., `azext-pt/v1` for updates, `azext-pt/v2` to create a new tag for breaking changes)
3. Click "Run workflow"

The workflow automatically handles both new and existing tags. It's protected by a GitHub ruleset—only the workflow can modify `azext-pt/*` tags.
