# ESLint Config for Azure Visual Studio Code Extensions

Contains default eslint configuration for Azure extensions.

# Minimal Usage

1. Add `eslint.config.mjs` to the root of your extension package:
    ```js
    // Other configurations exist
    export { azExtEslintRecommended as default } from '@microsoft/vscode-azext-eng/eslint';
    ```

1. Add the script to `package.json`:
    ```diff
        "scripts": [
    +        "lint": "eslint --max-warnings 0"
        ]
    ```

1. (Recommended) Include `dbaeumer.vscode-eslint` as an extension recommendation in `.vscode/extensions.json`:
    ```diff
        "recommendations": [
    +        "dbaeumer.vscode-eslint",
        ],
    ```

# Normal Usage

Check out [Container Tools](https://github.com/microsoft/vscode-containers) for a more advanced example,
including custom linter rules. The important file to check out is `eslint.config.mjs`.

# Unused Bindings

All shared presets ignore underscore-prefixed unused variables and caught errors,
and allow their names under the naming convention. Core `no-unused-vars` is disabled
in favor of the TypeScript rule. Existing argument policy is unchanged: unused
function parameters remain allowed, with underscore-prefix options also configured
for consumers that enable argument checking.

# Composable Options

Select a dedicated lint tsconfig for a monorepo without disabling type checking:

```js
import {
    azExtEslintStrictTypeChecked,
    explicitTsProjectRuleConfig,
    importRestrictionsRuleConfig,
} from '@microsoft/vscode-azext-eng/eslint';
import { fileURLToPath } from 'node:url';

export default [
    ...azExtEslintStrictTypeChecked,
    explicitTsProjectRuleConfig(
        './tsconfig.lint.json',
        fileURLToPath(new URL('.', import.meta.url)),
    ),
    importRestrictionsRuleConfig({
        typeOnlyModules: ['vscode'],
        lazyPatterns: ['@azure/*', '!@azure/core-process'],
    }),
];
```

`explicitTsProjectRuleConfig` accepts a tsconfig path or array of paths and an
optional `tsconfigRootDir`. It disables `projectService` only for that composed
config; the shared presets retain their existing project-service default.

`importRestrictionsRuleConfig` combines type-only module boundaries with patterns
requiring lazy runtime imports. Type imports remain allowed. Dynamic imports remain
allowed for lazy patterns. Both sets are emitted as one TypeScript-aware
`no-restricted-imports` rule, avoiding accidental replacement when stacking separate
rule fragments. The core rule is disabled to avoid duplicate diagnostics.
`lazyImportRuleConfig` continues to work and delegates to the combined helper.

Keep project aliases, pattern exceptions, and file-scoped boundaries downstream.
Like other ESLint rule overrides, a later restriction config replaces the earlier
rule's options: pass the complete desired restrictions to one call. Test-only rule
relaxations cover `.test.ts`, `.test.mts`, and `.test.cts`.

---

[Back to Root](../../README.md)
