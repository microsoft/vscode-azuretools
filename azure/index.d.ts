/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import { AuthorizationManagementClient, type RoleDefinition } from '@azure/arm-authorization';
import { Identity, ManagedServiceIdentityClient } from '@azure/arm-msi';
import type { ExtendedLocation, ResourceGroup } from '@azure/arm-resources';
import type { Location } from '@azure/arm-resources-subscriptions';
import type { StorageAccount } from '@azure/arm-storage';
import type { ServiceClient, ServiceClientOptions } from '@azure/core-client';
import type { PagedAsyncIterableIterator } from '@azure/core-paging';
import type { PipelineRequestOptions, PipelineResponse } from '@azure/core-rest-pipeline';
import type { Environment } from '@azure/ms-rest-azure-env';
import type { AzExtParentTreeItem, AzExtServiceClientCredentials, AzExtServiceClientCredentialsT2, AzExtTreeItem, AzureNameStep, AzureWizardExecuteStep, AzureWizardExecuteStepWithActivityOutput, AzureWizardPromptStep, IActionContext, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IAzureUserInput, IRelatedNameWizardContext, ISubscriptionActionContext, ISubscriptionContext, IWizardOptions, TreeElementBase, UIExtensionVariables } from '@microsoft/vscode-azext-utils';
import type { AzureSubscription } from '@microsoft/vscode-azureresources-api';
import { Disposable, LogOutputChannel, Progress, ProviderResult, TreeItem, Uri } from 'vscode';

export type OpenInPortalOptions = {
    /**
     * A query string applied directly to the host URL, e.g. "feature.staticwebsites=true" (turns on a preview feature)
     */
    queryPrefix?: string;
};

/**
 * Implement this class to display resources under a standard subscription tree item
 */
export declare abstract class SubscriptionTreeItemBase extends AzExtParentTreeItem {
    public static readonly contextValue: string;
    public readonly contextValue: string;
    public readonly label: string;
    constructor(parent: AzExtParentTreeItem, subscription: ISubscriptionContext);
}

/**
 * A tree item for an Azure Account, which will display subscriptions. For Azure-centered extensions, this will be at the root of the tree.
 */
export declare abstract class AzureAccountTreeItemBase extends AzExtParentTreeItem implements Disposable {
    public static readonly contextValue: string;
    public contextValue: string;
    public label: string;
    public disposables: Disposable[];
    public childTypeLabel: string;
    public autoSelectInTreeItemPicker: boolean;

    //#region Methods implemented by base class
    /**
     * Implement this to create a subscription tree item under this Azure Account node
     * @param root Contains basic information about the subscription - should be passed in to the constructor of `SubscriptionTreeItemBase`
     */
    public abstract createSubscriptionTreeItem(root: ISubscriptionContext): SubscriptionTreeItemBase | Promise<SubscriptionTreeItemBase>;
    //#endregion

    /**
     * Azure Account Tree Item
     * @param parent The parent of this node or undefined if it's the root of the tree.
     * @param testAccount Unofficial api for testing - see `TestAzureAccount` in @microsoft/vscode-azext-dev package
     */
    public constructor(parent?: AzExtParentTreeItem, testAccount?: {});

    public dispose(): void;

    /**
     * If user is logged in and only has one subscription selected, adds that to the wizardContext and returns undefined
     * Else, returns a prompt step for a subscription
     */
    public getSubscriptionPromptStep(wizardContext: Partial<ISubscriptionActionContext>): Promise<AzureWizardPromptStep<ISubscriptionActionContext> | undefined>;

    public hasMoreChildrenImpl(): boolean;
    public loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;
    public pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem | undefined>;
    public getIsLoggedIn(): Promise<boolean>;
}

/**
* Combines the root.environment.portalLink and id to open the resource in the portal.
*
* NOTE: If root is a tree item, it will find the subscription ancestor and get environment.portalLink from there
*/
export declare function openInPortal(root: ISubscriptionContext | AzExtTreeItem, id: string, options?: OpenInPortalOptions): Promise<void>;

export type AzExtLocation = Location & {
    id: string;
    name: string;
    displayName: string;
}

/**
 * Currently no location-specific properties on the wizard context, but keeping this interface for backwards compatibility and ease of use
 * Instead, use static methods on `LocationListStep` like `getLocation` and `setLocationSubset`
 */
export interface ILocationWizardContext extends ISubscriptionActionContext {
    includeExtendedLocations?: boolean;
}

export declare class LocationListStep<T extends ILocationWizardContext> extends AzureWizardPromptStep<T> {
    protected constructor();

    /**
     * Adds a LocationListStep to the wizard.  This function will ensure there is only one LocationListStep per wizard context.
     * @param wizardContext The context of the wizard
     * @param promptSteps The array of steps to include the LocationListStep to
     * @param options Options to pass to ui.showQuickPick. Options are spread onto the defaults.
     */
    public static addStep<T extends ILocationWizardContext>(wizardContext: IActionContext & Partial<ILocationWizardContext>, promptSteps: AzureWizardPromptStep<T>[], options?: IAzureQuickPickOptions): void;

    /**
     * This will set the wizard context's location (in which case the user will _not_ be prompted for location)
     * For example, if the user selects an existing resource, you might want to use that location as the default for the wizard's other resources
     * This _will_ set the location even if not all providers support it - in the hopes that a related location can be found during `getLocation`
     * @param wizardContext The context of the wizard
     * @param name The name or display name of the location
     */
    public static setLocation<T extends ILocationWizardContext>(wizardContext: T, name: string): Promise<void>;

    /**
     * Sets a location to auto-select during prompting, if available.
     * Use this instead of `setLocation` when you want to automatically select a location
     * that respects all future resource providers.
     * @param wizardContext The context of the wizard
     * @param name The name or display name of the suggested location
     */
    public static setAutoSelectLocation<T extends ILocationWizardContext>(wizardContext: T, name: string): Promise<void>;

    /**
     * Resets all location and location-related metadata on the wizard context back to its uninitialized state.
     * This includes clearing the selected location, cached location tasks, provider location maps, and any step-tracking flags.
     * Use this to ensure the wizard context is fully reset before starting a new location selection process.
     * @param wizardContext The context of the wizard
     */
    public static resetLocation<T extends ILocationWizardContext>(wizardContext: T): void;

    /**
     * Specify a task that will be used to filter locations
     * @param wizardContext The context of the wizard
     * @param task A task evaluating to the locations supported by this provider
     * @param provider The relevant provider (i.e. 'Microsoft.Web')
     */
    public static setLocationSubset<T extends ILocationWizardContext>(wizardContext: T, task: Promise<string[]>, provider: string): void;

    /**
     * Adds default location filtering for a provider
     * If more granular filtering is needed, use `setLocationSubset` instead (i.e. if the provider further filters locations based on features)
     * @param wizardContext The context of the wizard
     * @param provider The provider (i.e. 'Microsoft.Storage')
     * @param resourceType The resource type (i.e. 'storageAccounts')
     */
    public static addProviderForFiltering<T extends ILocationWizardContext>(wizardContext: T, provider: string, resourceType: string): void;

    /**
     * Used to convert a location into a home location and an extended location if the location passed in is an extended location.
     * If the location passed in is not extended, then extendedLocation will be `undefined`.
     * @param location location or extended location
     */
    public static getExtendedLocation(location: AzExtLocation): { location: string, extendedLocation?: ExtendedLocation };

    /**
     * Gets the `autoSelectLocation` for this wizard.  This location will be automatically selected during prompting, if available.
     * @param wizardContext The context of the wizard
     */
    public static getAutoSelectLocation<T extends ILocationWizardContext>(wizardContext: T): AzExtLocation | undefined;

    /**
     * Gets the selected location for this wizard.
     * @param wizardContext The context of the wizard
     * @param provider If specified, this will check against that provider's supported locations and attempt to find a "related" location if the selected location is not supported.
     * @param supportsExtendedLocations If set to true, the location returned may be an extended location, in which case the `extendedLocation` property should be added when creating a resource
     */
    public static getLocation<T extends ILocationWizardContext>(wizardContext: T, provider?: string, supportsExtendedLocations?: boolean): Promise<AzExtLocation>;

    /**
     * Returns true if a location has been set on the context
     */
    public static hasLocation<T extends ILocationWizardContext>(wizardContext: T): boolean;

    /**
     * Used to get locations. By passing in the context, we can ensure that Azure is only queried once for the entire wizard
     * @param wizardContext The context of the wizard.
     */
    public static getLocations<T extends ILocationWizardContext>(wizardContext: T): Promise<AzExtLocation[]>;

    /**
     * Returns true if the given location matches the name
     */
    public static locationMatchesName(location: AzExtLocation, name: string): boolean;

    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;

    protected getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<AzExtLocation>[]>;

    public static generalizeLocationName(name: string | undefined): string;

    /**
     * Implement this to set descriptions on location quick pick items.
     */
    public static getQuickPickDescription?: (location: AzExtLocation) => string | undefined;
}

/**
 * Checks to see if providers (i.e. 'Microsoft.Web') are registered and registers them if they're not
 */
export declare class VerifyProvidersStep<T extends ISubscriptionActionContext> extends AzureWizardExecuteStep<T> {
    /**
     * 90
     */
    public priority: number;

    /**
     * @param providers List of providers to verify
     */
    public constructor(providers: string[]);

    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
}

export interface IResourceGroupWizardContext extends ILocationWizardContext, IRelatedNameWizardContext {
    /**
     * Internal value indicating the last resource group name checked with `ResourceGroupVerifyStep`.
     * This name does not indicate a successful outcome from the verification step, it only indicates that the check has taken place.
     */
    _lastResourceGroupNameVerified?: string;

    /**
     * The resource group to use for new resources.
     * If an existing resource group is picked, this value will be defined after `ResourceGroupListStep.prompt` occurs
     * If a new resource group is picked, this value will be defined after the `execute` phase of the 'create' subwizard
     */
    resourceGroup?: ResourceGroup;

    /**
     * The task used to get existing resource groups.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    resourceGroupsTask?: Promise<ResourceGroup[]>;

    newResourceGroupName?: string;

    /**
     * By default, users will be prompted to select an existing resource group if creating one fails with a 403 error. Set this to `true` to prevent that behavior
     */
    suppress403Handling?: boolean;

    /**
     * Will automatically be generated by UserAssignedIdentityCreateStep if not specified by the user
     */
    newManagedIdentityName?: string;

    /**
     * The managed identity that will be assigned to the resource such as a function app or container app
     * If you need to grant access to a resource, such as a storage account or SQL database, you can use this managed identity to create a role assignment
     * with the RoleAssignmentExecuteStep
     */
    managedIdentity?: Identity;

    ui: IAzureUserInput;
}

export declare const resourceGroupNamingRules: IAzureNamingRules;

export declare class ResourceGroupListStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    /**
     * Used to get existing resource groups. By passing in the context, we can ensure that Azure is only queried once for the entire wizard
     * @param wizardContext The context of the wizard.
     */
    public static getResourceGroups<T extends IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceGroup[]>;

    /**
     * Checks existing resource groups in the wizard's subscription to see if the name is available.
     * @param wizardContext The context of the wizard.
     */
    public static isNameAvailable<T extends IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean>;

    public prompt(wizardContext: T): Promise<void>;
    public getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined>;
    public shouldPrompt(wizardContext: T): boolean;
}

export declare class ResourceGroupNameStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;
}

export declare class ResourceGroupVerifyStep<T extends IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    public stepName: string;
    protected getOutputLogSuccess(context: T): string;
    protected getOutputLogFail(context: T): string;
    protected getTreeItemLabel(context: T): string;

    /**
     * 95
     */
    public priority: number;
    public configureBeforeExecute(wizardContext: T): void | Promise<void>;
    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
}

export declare class ResourceGroupCreateStep<T extends IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    public stepName: string;
    protected getOutputLogSuccess(context: T): string;
    protected getOutputLogFail(context: T): string;
    protected getTreeItemLabel(context: T): string;

    /**
     * 100
     */
    public priority: number;
    public configureBeforeExecute(wizardContext: T): void | Promise<void>;
    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
}

export interface IStorageAccountWizardContext extends IResourceGroupWizardContext {
    /**
     * The storage account to use.
     * If an existing storage account is picked, this value will be defined after `StorageAccountListStep.prompt` occurs
     * If a new storage account is picked, this value will be defined after the `execute` phase of the 'create' subwizard
     */
    storageAccount?: StorageAccount;

    newStorageAccountName?: string;
    /**
     * This controls whether the storage account can generate connection strings.
     * This should be disabled for storage accounts that are using managed identity only.
     */
    disableSharedKeyAccess?: boolean;
}

export declare enum StorageAccountKind {
    Storage = "Storage",
    StorageV2 = "StorageV2",
    BlobStorage = "BlobStorage",
    BlockBlobStorage = "BlockBlobStorage",
}

export declare enum StorageAccountPerformance {
    Standard = "Standard",
    Premium = "Premium",
}

export declare enum StorageAccountReplication {
    /**
     * Locally redundant storage
     */
    LRS = "LRS",
    /**
     * Zone-redundant storage
     */
    ZRS = "ZRS",
    /**
     * Geo-redundant storage
     */
    GRS = "GRS",
    /**
     * Read-access geo-redundant storage
     */
    RAGRS = "RAGRS",
}

export interface INewStorageAccountDefaults {
    kind: StorageAccountKind;
    performance: StorageAccountPerformance;
    replication: StorageAccountReplication;
}

export interface IStorageAccountFilters {
    kind?: StorageAccountKind[];
    performance?: StorageAccountPerformance[];
    replication?: StorageAccountReplication[];

    /**
     * If specified, a 'learn more' option will be displayed to explain why some storage accounts were filtered
     */
    learnMoreLink?: string;
}

export declare const storageAccountNamingRules: IAzureNamingRules;
export declare class StorageAccountListStep<T extends IStorageAccountWizardContext> extends AzureWizardPromptStep<T> {
    /**
     * @param createOptions Default options to use when creating a Storage Account
     * @param filterOptions Optional filters used when listing Storage Accounts
     */
    public constructor(createOptions: INewStorageAccountDefaults, filterOptions?: IStorageAccountFilters);

    public static isNameAvailable<T extends IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean>;

    public prompt(wizardContext: T): Promise<void>;
    public getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined>;
    public shouldPrompt(wizardContext: T): boolean;
}

export declare class StorageAccountNameStep<T extends IStorageAccountWizardContext> extends AzureNameStep<T> {
    public constructor();

    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;

    protected isRelatedNameAvailable(wizardContext: T, name: string): Promise<boolean>;
}

export declare class StorageAccountCreateStep<T extends IStorageAccountWizardContext> extends AzureWizardExecuteStep<T> {
    /**
     * 130
     */
    public priority: number;
    public constructor(defaults: INewStorageAccountDefaults);

    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
}

export declare class UserAssignedIdentityListStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    public constructor(suppressCreate?: boolean);

    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;
}

export declare class UserAssignedIdentityNameStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    public constructor();

    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;

    static isNameAvailable(wizardContext: IResourceGroupWizardContext, rgName: string, identityName: string): Promise<boolean>;
    static tryGenerateRelatedName(wizardContext: IResourceGroupWizardContext, rgName: string): Promise<string | undefined>;
}

export declare class UserAssignedIdentityCreateStep<T extends IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> {
    /**
     * 140
     */
    public priority: number;
    public constructor();

    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
}

export declare class RoleAssignmentExecuteStep<T extends IResourceGroupWizardContext, TKey extends keyof T> extends AzureWizardExecuteStep<T> {
    /**
     * 900
     */
    public priority: number;
    /**
    * @param getScopeId A function that returns the scope id for the role assignment.
    * The scope ID is the Azure ID of the resource that we are granting access to such as a storage account.
    * Example: `/subscriptions/xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx/resourceGroups/rgName/providers/Microsoft.Storage/storageAccounts/resourceName`
    * This typically won't exist until _after_ the wizard executes and the resource is created, so we need to pass in a function that returns the ID.
    * If the scope ID is undefined, the step will throw an error.
    * @param roles An array of roles. Each role is an object and include the ARM role definition id and name of the role definition.
    * */
    public constructor(roles: () => (Role[] | Promise<Role[]> | undefined), options?: { priority?: number });

    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
}

export interface Role {
    /**
     * The scope of the operation or resource. Valid scopes are: subscription (format:
     *    '/subscriptions/{subscriptionId}'), resource group (format:
     *    '/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}', or resource (format:
     *    '/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/{resourceProviderNamespace}/[{parentResourcePath}/]{resourceType}/{resourceName}'
     */
    scopeId: string | undefined;
    /**
     * The role definition id of the role to assign. This can be created using `createRoleId`
     */
    roleDefinitionId: string;
    /**
     *  The name of the role definition to assign
     */
    roleDefinitionName: string;
}

export interface IAzureUtilsExtensionVariables extends UIExtensionVariables {
    prefix: string;
}

/**
 * Call this to register common variables used throughout the UI package.
 */
export declare function registerAzureUtilsExtensionVariables(extVars: IAzureUtilsExtensionVariables): void;

/**
 * Credential type to be used for creating generic http rest clients
 */
export type AzExtGenericCredentials = AzExtServiceClientCredentialsT2 | AzExtServiceClientCredentials;
export type AzExtGenericClientInfo = AzExtGenericCredentials | { credentials: AzExtGenericCredentials; environment: Environment; } | undefined;

/**
 * Creates a generic http rest client (i.e. for non-Azure calls or for Azure calls that the available sdks don't support), ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns (if clientInfo corresponds to an Azure environment)
 * @param clientInfo The client/credentials info or `undefined` if no credentials are needed
 */
export declare function createGenericClient(context: IActionContext, clientInfo: AzExtGenericClientInfo | undefined, options?: IGenericClientOptions): Promise<ServiceClient>;
export interface IGenericClientOptions {
    noRetryPolicy?: boolean;
    addStatusCodePolicy?: boolean;
    endpoint?: string;
}

/**
 * Used to create Azure clients for managed identity without having to install the sdk into client extension package.json
 */
export function createManagedServiceIdentityClient(context: AzExtClientContext): Promise<ManagedServiceIdentityClient>
export function createAuthorizationManagementClient(context: AzExtClientContext): Promise<AuthorizationManagementClient>

export type AzExtRequestPrepareOptions = PipelineRequestOptions & { rejectUnauthorized?: boolean }
export type AzExtPipelineResponse = PipelineResponse & { parsedBody?: any }

/**
 * Send request with a timeout specified and turn off retry policy (because retrying could take a lot longer)
 * @param timeout The timeout in milliseconds
 * @param clientInfo The client/credentials info or `undefined` if no credentials are needed
 */
export declare function sendRequestWithTimeout(context: IActionContext, options: AzExtRequestPrepareOptions, timeout: number, clientInfo: AzExtGenericClientInfo): Promise<AzExtPipelineResponse>;

export type AzExtClientType<T extends ServiceClient> = new (credentials: AzExtServiceClientCredentials, subscriptionId: string, options?: ServiceClientOptions) => T;

/**
 * Convenience type to give us multiple ways to specify subscription info and action context depending on the scenario
 */
export type AzExtClientContext = ISubscriptionActionContext | [IActionContext, ISubscriptionContext | AzExtTreeItem];

/**
 * Converts `AzExtClientContext` into a single object: `ISubscriptionActionContext`
 */
export declare function parseClientContext(clientContext: AzExtClientContext): ISubscriptionActionContext;

/**
 * Creates an Azure client, ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns
 */
export declare function createAzureClient<T extends ServiceClient>(context: AzExtClientContext, clientType: AzExtClientType<T>): T;

export type AzExtSubscriptionClientType<T> = new (credentials: AzExtServiceClientCredentials, options?: ServiceClientOptions) => T;

/**
 * Creates an Azure subscription client, ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns
 */
export declare function createAzureSubscriptionClient<T>(context: AzExtClientContext, clientType: AzExtSubscriptionClientType<T>): T;

export declare namespace uiUtils {
    export function listAllIterator<T>(iterator: PagedAsyncIterableIterator<T>): Promise<T[]>
}

interface ParsedAzureResourceId {
    rawId: string;
    subscriptionId: string;
    resourceGroup: string;
    provider: string;
    resourceName: string;
}

interface ParsedAzureResourceGroupId {
    rawId: string;
    subscriptionId: string;
    resourceGroup: string;
}

export function parseAzureResourceId(id: string): ParsedAzureResourceId;
export function parseAzureResourceGroupId(id: string): ParsedAzureResourceGroupId;
export function getResourceGroupFromId(id: string): string;

export declare function createPortalUri(subscription: AzureSubscription, id: string, options?: OpenInPortalOptions): Uri;

/**
 * Pipe Azure SDK logs into the provided log outptut channel using the @azure/logger package.
 *
 * @param logOutputChannel - log output channel to pipe logs into
 */
export function setupAzureLogger(logOutputChannel: LogOutputChannel): Disposable;

/**
 * Replaces the usage of BasicAuthenticationCredentials for ServiceClients imported from @azure/core-pipelines
 *
 * @param client - The service client. This will typically be a generalClient
 * @param userName - Username to be used with basic authentication login
 * @param password - Password. Gets encoded before being set in the header
 */
export function addBasicAuthenticationCredentialsToClient(client: ServiceClient, userName: string, password: string): void;

/**
 * Common Roles that should be used to assign permissions to resources
 * The role definitions can be found here: https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
 */
export declare const CommonRoleDefinitions: {
    readonly storageBlobDataContributor: {
        readonly name: "ba92f5b4-2d11-453d-a403-e96b0029c9fe";
        readonly type: "Microsoft.Authorization/roleDefinitions";
        readonly roleName: "Storage Blob Data Contributor";
        readonly description: "Allows for read, write and delete access to Azure Storage blob containers and data";
        readonly roleType: "BuiltInRole";
    };
    readonly storageBlobDataOwner: {
        readonly name: "b7e6dc6d-f1e8-4753-8033-0f276bb0955b",
        readonly type: "Microsoft.Authorization/roleDefinitions",
        readonly roleName: "Storage Blob Data Owner",
        readonly description: "Allows for full access to Azure Storage blob containers and data, including assigning POSIX access control.",
        readonly roleType: "BuiltInRole"
    };
    readonly storageQueueDataContributor: {
        readonly name: "974c5e8b-45b9-4653-ba55-5f855dd0fb88",
        readonly type: "Microsoft.Authorization/roleDefinitions",
        readonly roleName: "Storage Queue Data Contributor",
        readonly description: "Read, write, and delete Azure Storage queues and queue messages.",
        readonly roleType: "BuiltInRole"
    };
    readonly azureServiceBusDataReceiver: {
        readonly name: "4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0",
        readonly type: "Microsoft.Authorization/roleDefinitions",
        readonly roleName: "Azure Service Bus Data Receiver",
        readonly description: "Allows for receive access to Azure Service Bus resources.",
        readonly sroleType: "BuiltInRole"
    };
    readonly azureServiceBusDataOwner: {
        readonly name: "090c5cfd-751d-490a-894a-3ce6f1109419",
        readonly type: "Microsoft.Authorization/roleDefinitions",
        readonly roleName: "Azure Service Bus Data Owner",
        readonly description: "Allows for full access to Azure Service Bus resources.",
        readonly roleType: "BuiltInRole"
    };
    readonly azureEventHubsDataReceiver: {
        readonly name: "a638d3c7-ab3a-418d-83e6-5f17a39d4fde",
        readonly type: "Microsoft.Authorization/roleDefinitions",
        readonly roleName: "Azure Event Hubs Data Receiver",
        readonly description: "Allows receive access to Azure Event Hubs resources.",
        readonly roleType: "BuiltInRole"
    };
    readonly azureEventHubsDataOwner: {
        readonly name: "f526a384-b230-433a-b45c-95f59c4a2dec",
        readonly type: "Microsoft.Authorization/roleDefinitions",
        readonly roleName: "Azure Event Hubs Data Owner",
        readonly description: "Allows for full access to Azure Event Hubs resources.",
        readonly roleType: "BuiltInRole"
    };
    readonly cosmosDBAccountReader: {
        readonly name: "fbdf93bf-df7d-467e-a4d2-9458aa1360c8",
        readonly type: "Microsoft.Authorization/roleDefinitions",
        readonly roleName: "Cosmos DB Account Reader",
        readonly description: "Can read Azure Cosmos DB account data.",
        readonly roleType: "BuiltInRole"
    };
    readonly documentDBAccountContributor: {
        readonly name: "5bd9cd88-fe45-4216-938b-f97437e15450",
        readonly type: "Microsoft.Authorization/roleDefinitions",
        readonly roleName: "DocumentDB Account Contributor",
        readonly description: "Can manage Azure Cosmos DB accounts.",
        readonly roleType: "BuiltInRole"
    },
    readonly durableTaskDataContributor: {
        name: "0ad04412-c4d5-4796-b79c-f76d14c8d402",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Durable Task Data Contributor",
        description: "Durable Task role for all data access operations.",
        roleType: "BuiltInRole"
    },
};
/**
 * Constructs the role id for a given subscription and role name id
 *
 * @param subscriptionId - Id for the subscription
 * @param roleId - Name id for the role to be assigned (i.e CommonRoleDefinitions.storageBlobDataContributor.name)
 */
export function createRoleId(subscriptionId: string, RoleDefinition: RoleDefinition): string;

/**
 * creates all RoleDefinitionsItem for an entire managed identity object
 */
export function createRoleDefinitionsItems(
    context: IActionContext,
    subscription: AzureSubscription | ISubscriptionContext,
    msi: Identity,
    parentResourceId: string,
): Promise<RoleDefinitionsItem[]>

/**
 * should not be created directly; use `createRoleDefinitionsItems` instead
 */
export type RoleDefinitionsItem = {
    getChildren?(): ProviderResult<TreeElementBase[]>;
    getTreeItem(): TreeItem | Thenable<TreeItem>;
    id?: string | undefined;
}

/**
 * Requires a RoleDefinitionsItem as a data model in its constructor. Used for v1.5 API versions of the extensions
 */
export class RoleDefinitionsTreeItem extends AzExtParentTreeItem {
    constructor(parent: AzExtParentTreeItem, roleDefinitionsItem: RoleDefinitionsItem);
    public loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;
    public hasMoreChildrenImpl(): boolean;
    public label: string;
    public contextValue: string;
}

export const IdentityProvider: string;
export const UserAssignedIdentityResourceType: string;
