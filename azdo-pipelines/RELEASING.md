# Releasing New Pipeline Templates

Because consumers of these pipeline templates typically do not reference `main` directly, changes merged into `main` are not automatically deployed to consumers. We use Git tags for this, for example `azext-pt/v1`.

If at all possible, avoid breaking changes.

The steps for releasing are as follows:

1. Elevate to repository administrator [here](https://repos.opensource.microsoft.com/orgs/microsoft/repos/vscode-azuretools/jit/grant). This is required due to tag protection rules.
2. Run the appropriate script:
    - For non-breaking changes, delete and recreate the existing Git tag:

        ```bash
        git fetch origin main
        git push origin --delete azext-pt/v1
        git tag -d azext-pt/v1
        git tag azext-pt/v1 origin/main
        git push origin azext-pt/v1
        ```

    - For breaking changes, a new tag needs to be established with a new version:

        ```bash
        git fetch origin main
        git tag azext-pt/v2 origin/main
        git push origin azext-pt/v2
        ```

       Then, consumers will need to be updated accordingly.
