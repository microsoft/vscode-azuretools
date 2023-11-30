# VSCode Azure SDK for Node.js - Azure Auth

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This package provides a simple way to authenticate to Azure and receive Azure subscription information. It uses the [built-in Microsoft Authentication extension](https://github.com/microsoft/vscode/tree/main/extensions/microsoft-authentication) and does not rely on the [Azure Account extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account) in any way.

## Azure Subscription Provider

The `AzureSubscriptionProvider` interface describes the functions of this package.

```typescript
/**
 * An interface for obtaining Azure subscription information
 */
export interface AzureSubscriptionProvider {
    /**
     * Gets a list of tenants available to the user.
     * Use {@link isSignedIn} to check if the user is signed in to a particular tenant.
     *
     * @returns A list of tenants.
     */
    getTenants(): Promise<TenantIdDescription[]>;

    /**
     * Gets a list of Azure subscriptions available to the user.
     *
     * @param filter - Whether to filter the list returned, according to the list returned
     * by `getTenantFilters()` and `getSubscriptionFilters()`. Optional, default true.
     *
     * @returns A list of Azure subscriptions.
     *
     * @throws A {@link NotSignedInError} If the user is not signed in to Azure.
     * Use {@link isSignedIn} and/or {@link signIn} before this method to ensure
     * the user is signed in.
     */
    getSubscriptions(filter: boolean): Promise<AzureSubscription[]>;

    /**
     * Checks to see if a user is signed in.
     *
     * @param tenantId (Optional) Provide to check if a user is signed in to a specific tenant.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    isSignedIn(tenantId?: string): Promise<boolean>;

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @param tenantId (Optional) Provide to sign in to a specific tenant.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    signIn(tenantId?: string): Promise<boolean>;

    /**
     * An event that is fired when the user signs in. Debounced to fire at most once every 5 seconds.
     */
    onDidSignIn: vscode.Event<void>;

    /**
     * Signs the user out
     *
     * @deprecated Not currently supported by VS Code auth providers
     *
     * @throws Throws an {@link Error} every time
     */
    signOut(): Promise<void>;

    /**
     * An event that is fired when the user signs out. Debounced to fire at most once every 5 seconds.
     */
    onDidSignOut: vscode.Event<void>;
}
```

If the caller calls `getSubscriptions()` when the user is not signed in, a `NotSignedInError` will be thrown. You can check to see if a caught error is an instance of this error with `isNotSignedInError()`.

## Azure Cloud Configuration
Two methods are available for controlling the VSCode settings that determine what cloud is connected to when enumerating subscriptions.

```typescript
/**
 * Gets the configured Azure environment.
 *
 * @returns The configured Azure environment from the `microsoft-sovereign-cloud.endpoint` setting.
 */
export declare function getConfiguredAzureEnv(): azureEnv.Environment & {
    isCustomCloud: boolean;
};

/**
 * Sets the configured Azure cloud.
 *
 * @param cloud Use `'AzureCloud'` for public Azure cloud, `'AzureChinaCloud'` for Azure China, or `'AzureUSGovernment'` for Azure US Government.
 * These are the same values as the cloud names in `@azure/ms-rest-azure-env`. For a custom cloud, use an instance of the `@azure/ms-rest-azure-env` `EnvironmentParameters`.
 *
 * @param target (Optional) The configuration target to use, by default {@link vscode.ConfigurationTarget.Global}.
 */
export declare function setConfiguredAzureEnv(cloud: string | azureEnv.EnvironmentParameters, target?: vscode.ConfigurationTarget): Promise<void>;
```

## Logs

View the Microsoft Authentication extension logs by running the `Developer: Show Logs...` command from the VS Code command palette.

Change the log level by running the `Developer: Set Log Level...` command from the VS Code command palette. Select `Microsoft Authentication` from the list of loggers and then select the desired log level.

## License

[MIT](LICENSE.md)
