# VSCode Azure SDK for Node.js - Azure Auth

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This package provides a simple way to authenticate to Azure and receive Azure subscription information.

## Azure Subscription Provider

The `AzureSubscriptionProvider` interface describes the functions of this package.

```typescript
/**
 * An interface for obtaining Azure subscription information
 */
export interface AzureSubscriptionProvider {
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
     * @returns True if the user is signed in, false otherwise.
     */
    isSignedIn(): Promise<boolean>;

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    signIn(): Promise<boolean>;

    /**
     * Signs the user out
     *
     * @deprecated Not currently supported by VS Code auth providers
     *
     * @throws Throws an {@link Error} every time
     */
    signOut(): Promise<void>;
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

## License

[MIT](LICENSE.md)
