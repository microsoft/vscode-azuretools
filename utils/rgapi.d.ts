/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { AbstractAzExtTreeItem, AzExtParentTreeItem, AzExtTreeDataProvider, AzExtTreeItem, ISubscriptionContext, SealedAzExtTreeItem } from './index'; // This must remain `import type` or else a circular reference will result

/**
 * The API implemented by the Azure Resource Groups extension
 */
export interface AzureResourceGroupsExtensionApi {
    /**
     * The `AzExtTreeDataProvider` for the shared app resource view
     * @deprecated Use `appResourceTree` instead
     */
    readonly tree: AzExtTreeDataProvider;

    /**
     * The `AzExtTreeDataProvider` for the shared app resource view
     */
    readonly appResourceTree: AzExtTreeDataProvider;

    /**
     * The VSCode TreeView for the shared app resource view
     * @deprecated Use `appResourceTreeView` instead
     */
    readonly treeView: vscode.TreeView<AzExtTreeItem>;

    /**
     * The VSCode TreeView for the shared app resource view
     */
    readonly appResourceTreeView: vscode.TreeView<AzExtTreeItem>;

    /**
     * The `AzExtTreeDataProvider` for the shared local resource view
     */
    readonly localResourceTree: AzExtTreeDataProvider;

    /**
     * The VSCode TreeView for the shared local resource view
     */
    readonly localResourceTreeView: vscode.TreeView<AzExtTreeItem>;

    /**
     * Version of the API
     */
    readonly apiVersion: string;

    /**
     * Reveals an item in the shared app resource tree
     * @param resourceId The ARM resource ID to reveal
     */
    revealTreeItem(resourceId: string): Promise<void>;

    /**
     * Registers an app resource resolver
     * @param id The resolver ID. Must be unique.
     * @param resolver The resolver
     */
    registerApplicationResourceResolver(id: string, resolver: AppResourceResolver): vscode.Disposable;

    /**
     * Registers a local resource provider
     * @param id The provider ID. Must be unique.
     * @param provider The provider
     */
    registerLocalResourceProvider(id: string, provider: LocalResourceProvider): vscode.Disposable;

    /**
     * Registers an activity to appear in the activity window
     * @param activity The activity information to show
     */
    registerActivity(activity: Activity): Promise<void>;
}

/**
 * An abstract interface for GenericResource
 */
export interface AppResource {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly kind?: string;
    readonly location?: string;
    /** Resource tags */
    readonly tags?: {
        [propertyName: string]: string;
    };
    /* add more properties from GenericResource if needed */
}

/**
 * Defines how a group tree item is created and appears in the tree view
 */
export interface GroupNodeConfiguration {
    readonly label: string;
    readonly id: string;
    readonly description?: string;
    readonly icon?: vscode.ThemeIcon;
    readonly iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon;
    readonly contextValue?: string;
}

/**
 * Defines how a leaf tree item is grouped
 */
export interface GroupingConfig {
    readonly resourceGroup: GroupNodeConfiguration;
    readonly resourceType: GroupNodeConfiguration;
    [label: string]: GroupNodeConfiguration; // Don't need to support right off the bat but we can put it in the interface
}

/**
 * A resource that can be grouped
 */
export interface GroupableResource {
    readonly groupConfig: GroupingConfig;
}

interface ContextValuesToAdd {
    /**
     * Resolvers are not allowed to set the context value. Instead, they must provide `contextValuesToAdd`
     */
    contextValue?: never;

    /**
     * Optionally, context values to add to the tree item. The overall context value string is a deduped, alphabetized, semicolon-separated list of individual context values.
     */
    contextValuesToAdd?: string[];
}

/**
 * The base of the type that resolvers must return as their resolve result
 */
export type ResolvedAppResourceBase = Partial<{ [P in keyof SealedAzExtTreeItem]: never }> & Partial<AbstractAzExtTreeItem> & ContextValuesToAdd;

/**
 * A generic that describes the tree item that would be given as an argument to commands called on tree items in the shared resource tree
 */
export type ResolvedAppResourceTreeItem<T extends ResolvedAppResourceBase> = SealedAzExtTreeItem & AbstractAzExtTreeItem & Omit<T, keyof ResolvedAppResourceBase>;

/**
 * The interface that resource resolvers must implement
 */
export interface AppResourceResolver {
    /**
     * Resolves more information about an AppResource, filling in the remaining functionality of the tree item
     * @param subContext The Azure subscription context for the AppResource
     * @param resource The AppResource
     */
    resolveResource(subContext: ISubscriptionContext, resource: AppResource): vscode.ProviderResult<ResolvedAppResourceBase>;

    /**
     * Checks if this resolver is a match for a given AppResource. This should be designed to be as fast as possible.
     * @param resource The AppResource to check if this resolver matches
     */
    matchesResource(resource: AppResource): boolean;
}

// Not part of public interface to start with--only Resource Groups extension will call it (for now)
// currently implemented as AzureResourceProvider
export interface AppResourceProvider {
    provideResources(
        subContext: ISubscriptionContext
    ): vscode.ProviderResult<AppResource[]>;
}

/**
 * A type to describe the LocalResource objects that providers should give
 */
export type LocalResource = AzExtTreeItem;

/**
 * A provider for supplying items for the local resources tree (e.g., storage emulator, function apps in workspace, etc.)
 */
export interface LocalResourceProvider {
    /**
     * Called to supply the tree nodes to the LocalResource tree
     * @param parent The parent tree item (which will be the root of the local resource tree)
     */
    provideResources(parent: AzExtParentTreeItem): vscode.ProviderResult<LocalResource[] | undefined>;
}

/**
 * Represents an Activity to display in the Activity Log
 */
export interface Activity {
    /**
     * An ID for the activity. Must be unique.
     */
    id: string;

    /**
     * If the activity supports cancellation, provide this `CancellationTokenSource`. The Activity Log will add a cancel button that will trigger this CTS.
     */
    cancellationTokenSource?: vscode.CancellationTokenSource;

    /**
     * Fire this event to start the activity
     */
    onStart: vscode.Event<OnStartActivityData>;

    /**
     * Fire this event to report progress on the activity
     */
    onProgress: vscode.Event<OnProgressActivityData>;

    /**
     * Fire this event when the activity succeeds
     */
    onSuccess: vscode.Event<OnSuccessActivityData>;

    /**
     * Fire this event when the activity fails
     */
    onError: vscode.Event<OnErrorActivityData>;
}

/**
 * Options to set on the Activity log tree item
 */
export interface ActivityTreeItemOptions {
    /**
     * The label of the item
     */
    label: string;

    /**
     * Optionally, context values to add to the tree item. The overall context value string is a deduped, alphabetized, semicolon-separated list of individual context values.
     */
    contextValuesToAdd?: string[];

    /**
     * If the activity should have child tree items, implement this
     */
    getChildren?: (parent: AzExtParentTreeItem) => AzExtTreeItem[] | Promise<AzExtTreeItem[]>;
}

type ActivityEventData<T> = ActivityTreeItemOptions & T;

/**
 * Event data for activity start
 */
export type OnStartActivityData = ActivityEventData<{}>;

/**
 * Event data for activity progress
 */
export type OnProgressActivityData = ActivityEventData<{ message?: string }>;

/**
 * Event data for activity success
 */
export type OnSuccessActivityData = ActivityEventData<{}>;

/**
 * Event data for activity failure
 */
export type OnErrorActivityData = ActivityEventData<{ error: unknown }>;
