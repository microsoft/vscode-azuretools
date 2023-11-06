# Change Log

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
