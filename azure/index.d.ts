/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SubscriptionModels } from '@azure/arm-resources-subscriptions';
import type { Environment } from '@azure/ms-rest-azure-env';
import type { HttpOperationResponse, RequestPrepareOptions, ServiceClient } from '@azure/ms-rest-js';
import { Disposable, Progress } from 'vscode';
import type { AzExtParentTreeItem, AzExtServiceClientCredentials, AzExtTreeItem, AzureNameStep, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, ISubscriptionActionContext, ISubscriptionContext, IWizardOptions, UIExtensionVariables } from '@microsoft/vscode-azext-utils';
import { ExtendedLocation, ResourceGroup } from '@azure/arm-resources';
import { StorageAccount } from '@azure/arm-storage';

export type OpenInPortalOptions = {
    /**
     * A query string applied directly to the host URL, e.g. "feature.staticwebsites=true" (turns on a preview feature)
     */
    queryPrefix?: string;
};

/**
 * Implement this class to display resources under a standard subscription tree item
 */
export abstract class SubscriptionTreeItemBase extends AzExtParentTreeItem {
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
     * @param testAccount Unofficial api for testing - see `TestAzureAccount` in vscode-azureextensiondev package
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

export declare class UserCancelledError extends Error {
    constructor(stepName?: string);
}

export declare class NoResourceFoundError extends Error { }

export type AzExtLocation = SubscriptionModels.Location & {
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

    /**
     * Implement this to set descriptions on location quick pick items.
     */
    public static getQuickPickDescription?: (location: AzExtLocation) => string | undefined;
}

export interface IRelatedNameWizardContext extends IActionContext {
    /**
     * A task that evaluates to the related name that should be used as the default for other new resources or undefined if a unique name could not be found
     * The task will be defined after `AzureNameStep.prompt` occurs.
     */
    relatedNameTask?: Promise<string | undefined>;
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

export class ResourceGroupNameStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;
}

export declare class ResourceGroupCreateStep<T extends IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> {
    /**
     * 100
     */
    public priority: number;
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

export interface IAzureUtilsExtensionVariables extends UIExtensionVariables {
    prefix: string;
}

/**
 * Call this to register common variables used throughout the UI package.
 */
export declare function registerAzureUtilsExtensionVariables(extVars: IAzureUtilsExtensionVariables): void;

export interface IMinimumServiceClientOptions {
    acceptLanguage?: string,
    baseUri?: string;
    userAgent?: string | ((defaultUserAgent: string) => string);

    /**
     * NOTE: Using "any" to allow for the use of different versions of "@azure/ms-rest-js", which are largely compatible for our purposes
     */
    requestPolicyFactories?: any[] | ((defaultRequestPolicyFactories: any[]) => (void | any[]));
}

export type AzExtGenericClientInfo = AzExtServiceClientCredentials | { credentials: AzExtServiceClientCredentials; environment: Environment; } | undefined;

/**
 * Creates a generic http rest client (i.e. for non-Azure calls or for Azure calls that the available sdks don't support), ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns (if clientInfo corresponds to an Azure environment)
 * @param clientInfo The client/credentials info or `undefined` if no credentials are needed
 */
export function createGenericClient(context: IActionContext, clientInfo: AzExtGenericClientInfo): Promise<ServiceClient>;

export type AzExtRequestPrepareOptions = RequestPrepareOptions & { rejectUnauthorized?: boolean }

/**
 * Send request with a timeout specified and turn off retry policy (because retrying could take a lot longer)
 * @param timeout The timeout in milliseconds
 * @param clientInfo The client/credentials info or `undefined` if no credentials are needed
 */
export function sendRequestWithTimeout(context: IActionContext, options: AzExtRequestPrepareOptions, timeout: number, clientInfo: AzExtGenericClientInfo): Promise<HttpOperationResponse>;

export type AzExtClientType<T> = new (credentials: AzExtServiceClientCredentials, subscriptionId: string, options?: IMinimumServiceClientOptions) => T;

/**
 * Convenience type to give us multiple ways to specify subscription info and action context depending on the scenario
 */
export type AzExtClientContext = ISubscriptionActionContext | [IActionContext, ISubscriptionContext | AzExtTreeItem];

/**
 * Converts `AzExtClientContext` into a single object: `ISubscriptionActionContext`
 */
export function parseClientContext(clientContext: AzExtClientContext): ISubscriptionActionContext;

/**
 * Creates an Azure client, ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns
 */
export function createAzureClient<T>(context: AzExtClientContext, clientType: AzExtClientType<T>): T;

export type AzExtSubscriptionClientType<T> = new (credentials: AzExtServiceClientCredentials, options?: IMinimumServiceClientOptions) => T;

/**
 * Creates an Azure subscription client, ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns
 */
export function createAzureSubscriptionClient<T>(context: AzExtClientContext, clientType: AzExtSubscriptionClientType<T>): T;
