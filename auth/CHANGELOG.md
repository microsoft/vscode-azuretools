# Change Log

## 4.0.2 - 2024-12-19

* [#1861](https://github.com/microsoft/vscode-azuretools/pull/1861) Remove unecessary if statement

## 4.0.1 - 2024-12-17

* [#1856](https://github.com/microsoft/vscode-azuretools/pull/1856) Fix tenantId undefined error

## 4.0.0 - 2024-12-06

### What's new
Pass in a `vscode.LogOutputChannel` to the `VSCodeAzureSubscriptionProvider` constructor to enable logging. [#1851](https://github.com/microsoft/vscode-azuretools/pull/1851)

`AzureSubscriptionProvider.getTenants()` now returns `AzureTenant[]` instead of `TenantIdDescription[]`. This is a breaking change for implementors of `AzureSubscriptionProvider`. [#1849](https://github.com/microsoft/vscode-azuretools/pull/1849)

### All Changes
* [#1849](https://github.com/microsoft/vscode-azuretools/pull/1849) Create `AzureTenant` interface which includes account property
* [#1850](https://github.com/microsoft/vscode-azuretools/pull/1850) Clean up `isSignedIn` implementation
* [#1851](https://github.com/microsoft/vscode-azuretools/pull/1851) Add logging to `VSCodeAzureSubscriptionProvider`

## 3.1.0 - 2024-11-26

* [#1827](https://github.com/microsoft/vscode-azuretools/pull/1827) Add more comprehensive support for multi-account scenarios
* [#1815](https://github.com/microsoft/vscode-azuretools/issues/1815) Fix `VSCodeAzureSubscriptionProvider.getSubscriptions()` returning empty

## 3.0.1 - 2024-11-19
* [#1819](https://github.com/microsoft/vscode-azuretools/pull/1819) Add account parameter to `AzureSubscriptionProvider.isSignedIn()` function to fix a multi-account issue [#1809](https://github.com/microsoft/vscode-azuretools/issues/1809)
* [#1822](https://github.com/microsoft/vscode-azuretools/pull/1822) Add check in `VSCodeAzureSubscriptionProvider.getTenants()` to fix a multi-account issue [#1809](https://github.com/microsoft/vscode-azuretools/issues/1809)

## 3.0.0 - 2024-09-19
* [#1789](https://github.com/microsoft/vscode-azuretools/pull/1789) Change `getTenants` to be compatible with the new Azure Resources tenants view. This also includes a possible breaking change where an optional parameter `account` which when passed in `getTenants` will return the tenants associated with that single account. Otherwise `getTenants` will return the tenants for all authenticated accounts.

## 2.5.0 - 2024-08-06

* Add `getSessionWithScopes` to get a session that has the proper scoping instead of always the default management plane

## 2.4.1 - 2024-05-15

* [#1729](https://github.com/microsoft/vscode-azuretools/pull/1729) Change AzureDevOpsSubscriptionProvider so that it accepts values as arguments

## 2.4.0 - 2024-05-07

* [#1723](https://github.com/microsoft/vscode-azuretools/pull/1723) Implementation fo AzureSub provider that leverages federated credentials

## 2.1.0 - 2023-12-13

* Use management endpoint for scope by default to fix deploying app service projects with sovereign clouds

## 2.0.0 - 2023-11-20

* Switches to use `@azure/arm-resources-subscriptions` instead of `@azure/arm-subscriptions`. Potentially a breaking change so I revved the major version.
* Fixes an issue where the `endpoint` wasn't set for the subscription client, breaking sovereign clouds

## 1.4.0 - 2023-11-03
* [#1619](https://github.com/microsoft/vscode-azuretools/pull/1619) Make `getSession` synchronous to fix an issue that broke app service deployments

## 1.3.0 - 2023-10-23

* [#1610](https://github.com/microsoft/vscode-azuretools/pull/1610) Add `signInToTenant` command which facilitates signing in to a specific tenant.
* [#1610](https://github.com/microsoft/vscode-azuretools/pull/1610) Add `getUnauthenticatedTenants` utility.

## 1.2.2 - 2023-10-19

* [#1608](https://github.com/microsoft/vscode-azuretools/pull/1608) Fix appending `.default` to tenant id scope which caused sign in to fail

## 1.2.1 - 2023-09-26

* [#1594](https://github.com/microsoft/vscode-azuretools/pull/1594) Fix getScopes always injecting the management scope, even if a scope for a different resource is specified
* [#1597](https://github.com/microsoft/vscode-azuretools/pull/1597) Make `authentication.getSession` use scopes argument

## 1.1.3 - 2023-09-14

* [#1585](https://github.com/microsoft/vscode-azuretools/pull/1585) Check if tenant is signed in before listing subscriptions

## 1.1.2 - 2023-07-26

* [#1542](https://github.com/microsoft/vscode-azuretools/pull/1542) Fix Azure subscriptions are not returned in alphabetical order

## 1.1.1 - 2023-07-26

* [#1540](https://github.com/microsoft/vscode-azuretools/pull/1540) Ignore .default if it is passed as a scope

## 1.0.0 - 2023-06-05

Initial release
