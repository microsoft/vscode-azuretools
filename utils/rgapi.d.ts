/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Disposable } from 'vscode';
import { AbstractAzExtTreeItem, Activity, ISubscriptionContext, SealedAzExtTreeItem } from './index';
import { AzExtParentTreeItem } from './src/tree/AzExtParentTreeItem';
import { AzExtTreeDataProvider } from './src/tree/AzExtTreeDataProvider';
import { AzExtTreeItem } from './src/tree/AzExtTreeItem';

export interface AzureResourceGroupsExtensionApi {
    readonly tree: AzExtTreeDataProvider;
    readonly treeView: vscode.TreeView<AzExtTreeItem>;

    readonly apiVersion: string;
    revealTreeItem(resourceId: string): Promise<void>;
    registerApplicationResourceResolver(id: string, resolver: AppResourceResolver): Disposable;
    registerLocalResourceProvider(id: string, provider: LocalResourceProvider): Disposable;
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
     * These will be added to a Set<string> of context values. The array is *not* pre-initialized as an empty array.
     */
    contextValuesToAdd?: string[];
}

export type ResolvedAppResourceBase = Partial<{ [P in keyof SealedAzExtTreeItem]: never }> & Partial<AbstractAzExtTreeItem> & ContextValuesToAdd;

export type ResolvedAppResourceTreeItem<T extends ResolvedAppResourceBase> = SealedAzExtTreeItem & AbstractAzExtTreeItem & Omit<T, keyof ResolvedAppResourceBase>;

export type LocalResource = AzExtTreeItem;

export interface AppResourceResolver {
    resolveResource(subContext: ISubscriptionContext, resource: AppResource): vscode.ProviderResult<ResolvedAppResourceBase>;
    matchesResource(resource: AppResource): boolean;
}

/**
 * Resource extensions call this to register app resource resolvers.
 *
 * @param id
 * @param resolver
 */
export declare function registerApplicationResourceResolver(id: string, resolver: AppResourceResolver): vscode.Disposable;

// Not part of public interface to start with--only Resource Groups extension will call it (for now)
// currently implemented as AzureResourceProvider
export interface AppResourceProvider {
    provideResources(
        subContext: ISubscriptionContext
    ): vscode.ProviderResult<AppResource[]>;
}

export interface LocalResourceProvider {
    provideResources(parent: AzExtParentTreeItem): vscode.ProviderResult<LocalResource[] | undefined>;
}

// Resource Groups can have a default resolve() method that it supplies, that will activate the appropriate extension and give it a chance to replace the resolve() method
// ALSO, it will eliminate that default resolver from future calls for that resource type

// called from host extension (Resource Groups)
// Will need a manifest of extensions mapping type => extension ID
// export declare function registerApplicationResourceProvider(id: string, provider: AppResourceProvider): vscode.Disposable;

// resource extensions need to activate onView:localResourceView and call this
export declare function registerLocalResourceProvider(id: string, provider: LocalResourceProvider): vscode.Disposable;
