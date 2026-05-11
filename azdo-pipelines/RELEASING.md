# Releasing New Pipeline Templates

Because consumers of these pipeline templates typically do not reference `main` directly, changes merged into `main` are not automatically deployed to consumers. We use release branches for this, for example `azext-pt/v1`.

If at all possible, avoid breaking changes. If breaking changes are necessary, it is strongly suggested to add a step to the prior version that shows a warning to consumers that the version is deprecated and should be updated as soon as possible.

## Releasing

Releasing is done via the **Release Pipeline Templates** GitHub Actions workflow, which requires approval from the `release-pipeline-templates` GitHub environment (2 reviewers).

### Update an existing release branch (e.g., `azext-pt/v1`)

1. Go to **Actions** > **Release Pipeline Templates** > **Run workflow**
2. Enter the release branch name (e.g., `azext-pt/v1`)
3. Click **Run workflow**
4. Two reviewers must approve the environment deployment before the branch is updated

The workflow fast-forwards the release branch to the current `main` commit.

### Create a new release branch (e.g., `azext-pt/v2`) for breaking changes

1. Create a new branch from `main` named `azext-pt/vN` (e.g., `azext-pt/v2`)
2. Use the workflow above to manage subsequent releases

## Setup

The `release-pipeline-templates` GitHub environment must be configured with:

- **Required reviewers**: at least 2
- **Deployment branches**: limit to `main` (or all branches if preferred)

The release branches should also have branch protection rules. Note that GitHub Actions must be allowed to bypass the branch protection rules (e.g., via "Allow GitHub Actions to create and approve pull requests" or by adding the workflow's token to the bypass list), since the release workflow updates the branch via a direct push.
