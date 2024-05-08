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

## Azure DevOps Subscription Provider

The auth package also exports `AzureDevOpsSubscriptionProvider`, a class which implements the `AzureSubscriptionProvider` interface, that authenticates via
a federated Azure DevOps service connection, using workflow identity federation.

This provider is only available when running in the context of an Azure DevOps pipeline. It can be used to run E2E tests that require authentication to Azure,
without having to manage any secrets, passwords or connection strings.

Here is an example code of how you might use `AzureDevOpsSubscriptionProvider`:

```typescript
import { AzureDevOpsSubscriptionProvider } from "@microsoft/vscode-azext-azureauth";

const subscriptionProvider = new AzureDevOpsSubscriptionProvider();

const signedIn = await subscriptionProvider.signIn();
if (!signedIn) {
    throw new Error("Couldn't sign in");
}

const subscriptions = await subscriptionProvider.getSubscriptions();

// go logic on the subscriptions object
```

### Setting up workflow identity federation

In the following section, we will describe how to set up your ADO and Azure environment so you can use workflow identity federation, and use
`AzureDevOpsSubscriptionProvider` as in the code above.

1. Create a new service principal (in this example, an App Registration):
    1. Navigate to the [App Registrations](https://ms.portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) page on the Azure portal
    2. Click on "New Registration"
    3. Assign any name
    4. Make sure to select the first option for the account type ("Accounts in this organization directory only (Microsoft only - Single tenant)")
    5. Leave the Redirect URI and Service Tree ID fields empty
    6. Click on "Register"

2. Create a new Azure DevOps (ADO) "Service Connection" (in this example, create it under the DevDiv organization):
    1. Navigate to the [organization's (DevDiv) ADO page](https://devdiv.visualstudio.com/DevDiv)
    2. Navigate to the settings page by clicking on the gear icon on the bottom left
    3. Select the ["service connections"](https://devdiv.visualstudio.com/DevDiv/_settings/adminservices) blade from the panel on the left
    4. Create a new service connection by clicking on the "new service connection" button
    5. Select "Azure Resource Manager" as the type
    6. Select "Workload Identity federation (manual)" for the authentication type
    7. Provide a new name for your new service connection
    8. Click on "Next"
    9. This will create a new draft service connection, with the "issuer" and "subject identifier" fields already filled in.
    10. Leave this window open while you finish the next step, which will require those "issuer" and "subject identifier" fields, then you will return to this window to finish creating the service principal

3. Add a federated credential to connect your service principal to your new service connection
    1. Navigate back to the Azure Portal page for your service connection (app registration) from step 1
    2. Navigate to the "Certificates & secrets" blade
    3. Navigate to the "Federated credentials" tab
    4. Click on the "Add credential" button
    5. For the scenario, select "Other issuer"
    6. For the "issuer" and "subject identifier" fields, fill in with the details of your draft service connection from the previous step
    7. Select a new name for your new federated credential
    8. Click on "Add"

4. (Temporary but required) Grant your service principal reader role on the desired subscription
    1. This is not required for testing, but required to finish creating the service connection. This should be revoked after successful creation of the service connection and only necessary roles applied to the service principal.
    2. On the Azure Portal, navigate to the page for the subscription you want the service principal to have access to.
    3. Navigate to the "Access control (IAM)" blade
    4. Navigate to the "Roles" tab
    5. Click on the "+ Add" button, and choose "Add role assignment"
    6. Choose "Reader" and click "Next"
    7. Choose "User, group, or service principal", then click on "+ Select members"
    8. Select your service principal from step 1
    9. Click on "Review and assign"

5. Finish creating your service connection:
    1. Navigate back to your draft service connection from step 2
    2. For Environment, select "Azure Cloud"
    3. For Scope Level, choose Subscription
    4. Under "Subscription Id', and "Subscription Name", write the subscription ID and name (must provide both) for the desired subscription
    5. For "Service Principal Id", provide the "Application (client) ID" of your app registration from step 1 (can be found in the "Overview" blade)
    6. For the "Tenant ID", provide the "Directory (tenant) ID" of your app registration from step 1 (can be found in "Overview" blade)
    7. Click on "Verify and save"

6. Revoke unnecessary read access and assign only necessary roles
    1. Revoke the "Reader" role on the subscription for the service connection after it is created. This is no longer necessary.
    2. Navigate to "Access control (IAM)" blade.
    3. Under the "Role assignments" tab, find the role assignment corresponding to the App registered on step 1
    4. Click on "Remove" then "Yes"
    5. You can then assign the required roles to specific resources only if required, instead of assigning "Reader" role to the entire subscription.

7. Create a dummy Key Vault
    1. A dummy Key vault step is required to propagate the necessary environment variables in the context of the pipeline
    2. Create a new Key Vault resource in the subscription you want to test on
    3. Give it a new name as appropriate. You can keep the default settings

8. Assign your service principal "key vault reader" role on the dummy Key Vault
    1. Navigate to "Access control (IAM)" blade
    2. Navigate to the "Roles" tab
    3. Click on the "+ Add" button, and choose "Add role assignment"
    4. Choose "Key Vault Reader" (NOT "Reader") and click "Next"
    5. Choose "User, group, or service principal", then click on "+ Select members"
    6. Select your app registration from step 1
    7. Click on "Review and assign"

9. Add the dummy Key Vault step in the pipeline
    1. To ensure that the appropriate env variables are propagated in the context of running the pipeline, a dummy Key Vault step is required in that pipeline
    2. In the desired pipeline's `.yml` file, add a step as below. The `azureSubscription` field should correspond to the name of your service connection from step 2, while the `keyVaultName` field should correspond to the dummy key vault created in step 7:

        ```yml
         # This gives the AzCodeE2ETests service connection access to this pipeline.
        - task: AzureKeyVault@1
          displayName: 'Authorize AzCodeE2ETests service connection'
          inputs:
            azureSubscription: 'AzCodeE2ETests'
            KeyVaultName: 'AzCodeE2ETestsDummyKV'
          env:
            SYSTEM_ACCESSTOKEN: $(System.AccessToken)
        ```

    3. In the step which runs your code (e.g., the npm test step), make sure that the `$(System.AccessToken)` variable is manually propagated as a `SYSTEM_ACCESSTOKEN` environment variable. All other required environment variables should be propagated automatically:

        ```yml
        - task: Npm@1
          displayName: "\U0001F449 Test"
          inputs:
            command: custom
            customCommand: test
            workingDir: $(working_directory)
         condition: succeeded()
         env:
            SYSTEM_ACCESSTOKEN: $(System.AccessToken)
        ```

10. Set the appropriate environment variables to identify your service connection
    - The `AzureDevOpsSubscriptionProvider` expects three additional environment variables to be set in order to identify your service connection you setup in step 5.
    - These are:
      - `AzCodeServiceConnectionID`: The resource ID of the service connection created in step 2, which can be found on the `resourceId` field of the URL at the address bar, when viewing the service connection in the Azure DevOps portal
      - `AzCodeServiceConnectionDomain`: The `Tenant ID` field of the service connection properties, which can be accessed by clicking "Edit" on the service connection page
      - `AzCodeServiceConnectionClientID`: The `Service Principal Id` field of the service connection properties, which can be accessed by clicking "Edit" on the service connection page
    - Make sure these environment variables are set before construcring a `new AzureDevOpsServiceProvider()`. These values are _not_ secrets, so they can be set manually as environment variables, assigned as pipeline variables in ADO, accessed and assigned using an Azure Key Vault step, or even manually hardcoded in code (not recommended).



## Logs

View the Microsoft Authentication extension logs by running the `Developer: Show Logs...` command from the VS Code command palette.

Change the log level by running the `Developer: Set Log Level...` command from the VS Code command palette. Select `Microsoft Authentication` from the list of loggers and then select the desired log level.

## License

[MIT](LICENSE.md)
