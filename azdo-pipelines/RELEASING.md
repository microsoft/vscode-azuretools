# Releasing New Pipeline Templates

Because consumers of these pipeline templates typically do not reference `main` directly, changes merged into `main` are not automatically deployed to consumers. We use release branches for this, for example `azext-pt/v1`.

If at all possible, avoid breaking changes. If breaking changes are necessary, it is strongly suggested to add a step to the prior version that shows a warning to consumers that the version is deprecated and should be updated as soon as possible.

## Releasing

To update an existing release branch (e.g., `azext-pt/v1`) to the latest `main`:

1. Create a PR with `main` as the head and the release branch (e.g., `azext-pt/v1`) as the base
2. Review and merge the PR

To create a new release branch (e.g., `azext-pt/v2`) for breaking changes:

1. Create a new branch from `main` named `azext-pt/vN` (e.g., `azext-pt/v2`)

The release branches are protected by branch protection rules, requiring a PR to update them.
