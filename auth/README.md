# VSCode Azure SDK for Node.js - Azure Auth

This package provides a simple way to authenticate to Azure and receive Azure subscription information. It uses the [built-in Microsoft Authentication extension](https://github.com/microsoft/vscode/tree/main/extensions/microsoft-authentication) and does not rely on the [Azure Account extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account) in any way.

## Azure Subscription Provider

The [`AzureSubscriptionProvider`](./src/contracts/AzureSubscriptionProvider.ts) interface describes the functions of this package.

If the caller calls `getAvailableSubscriptions()` or `getAccounts()` when the user is not signed in, a `NotSignedInError` will be thrown. You can check to see if a caught error is an instance of this error with `isNotSignedInError()`.

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

## Azure DevOps Subscription Provider

The auth package also exports [`AzureDevOpsSubscriptionProvider`](./src/providers/AzureDevOpsSubscriptionProvider.ts), a class which implements the `AzureSubscriptionProvider` interface, which authenticates via
a federated Azure DevOps service connection, using [workflow identity federation](https://learn.microsoft.com/entra/workload-id/workload-identity-federation).

This provider only works when running in the context of an Azure DevOps pipeline. It can be used to run end-to-end tests that require authentication to Azure,
without having to manage any secrets, passwords or connection strings.

The constructor expects an initializer object with three values set to identify your ADO service connection to be used for authentication.
These are:

- `serviceConnectionId`: The resource ID of your service connection, which can be found on the `resourceId` field of the URL at the address bar, when viewing the service connection in the Azure DevOps portal
- `domain`: The `Tenant ID` field of the service connection properties, which can be accessed by clicking "Edit" on the service connection page
- `clientId`: The `Service Principal Id` field of the service connection properties, which can be accessed by clicking "Edit" on the service connection page

Here is an example code of how you might use `AzureDevOpsSubscriptionProvider`:

```typescript
import { AzureDevOpsSubscriptionProviderInitializer, AzureDevOpsSubscriptionProvider } from "@microsoft/vscode-azext-azureauth";

const initializer: AzureDevOpsSubscriptionProviderInitializer = {
    serviceConnectionId: "<REPLACE_WITH_SERVICE_CONNECTION_ID>",
    domain: "<REPLACE_WITH_DOMAIN>",
    clientId: "<REPLACE_WITH_CLIENT_ID>",
}

const subscriptionProvider = new AzureDevOpsSubscriptionProvider(initializer);

const signedIn = await subscriptionProvider.signIn();
if (!signedIn) {
    throw new Error("Couldn't sign in");
}

const subscriptions = await subscriptionProvider.getAvailableSubscriptions();

// logic on the subscriptions objects
```

For more detailed steps on how to setup your Azure environment to use workflow identity federation and use this `AzureDevOpsSubscriptionProvider` object effectively,
as well as the values needed to pass to `new AzureDevOpsSubscriptionProvider()`, please navigate to the workflow identity federation [guide](AzureFederatedCredentialsGuide.md).

## Logs

View the Microsoft Authentication extension logs by running the `Developer: Show Logs...` command from the VS Code command palette.

Change the log level by running the `Developer: Set Log Level...` command from the VS Code command palette. Select `Microsoft Authentication` from the list of loggers and then select the desired log level.

## License

[MIT](LICENSE.md)
