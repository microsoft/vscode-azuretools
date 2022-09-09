/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { AzExtResourceType, AzExtTreeItem, IActionContext } from "./index";
import * as vscode from 'vscode';
import type { Environment } from '@azure/ms-rest-azure-env';

export interface ApplicationAuthentication {
    getSession(scopes?: string[]): vscode.ProviderResult<vscode.AuthenticationSession>;
}

/**
 * Information specific to the Subscription
 */
export interface ApplicationSubscription {
    readonly authentication: ApplicationAuthentication;
    readonly displayName: string;
    readonly subscriptionId: string;
    readonly environment: Environment;
    readonly isCustomCloud: boolean;
}

export interface ResourceBase {
    readonly id: string;
    readonly name: string;
}

export interface ApplicationResourceType {
    readonly type: string;
    readonly kinds?: string[];
}

/**
 * Represents an individual resource in Azure.
 * @remarks The `id` property is expected to be the Azure resource ID.
 */
export interface ApplicationResource extends ResourceBase {
    readonly subscription: ApplicationSubscription;
    readonly type: ApplicationResourceType;
    readonly azExtResourceType?: AzExtResourceType;
    readonly location?: string;
    readonly resourceGroup?: string;
    /** Resource tags */
    readonly tags?: {
        [propertyName: string]: string;
    };
    /* add more properties from GenericResource if needed */
}

/**
 * Interface describing an object that wraps another object.
 *
 * The host extension will wrap all tree nodes provided by the client
 * extensions. When commands are executed, the wrapper objects are
 * sent directly to the client extension, which will need to unwrap
 * them. The `registerCommandWithTreeNodeUnboxing` method below, used
 * in place of `registerCommand`, will intelligently do this
 * unboxing automatically (i.e., will not unbox if the arguments
 * aren't boxes)
 */
export interface Box {
    unwrap<T>(): T;
}

/**
 * Describes command callbacks for tree node context menu commands
 */
export type TreeNodeCommandCallback<T> = (context: IActionContext, node?: T, nodes?: T[], ...args: any[]) => any;

/**
 * Describes filtering based on context value. Items that pass the filter will
 * match at least one of the `include` filters, but none of the `exclude` filters.
 */
export interface ContextValueFilter {
    /**
     * This filter will include items that match *any* of the values in the array.
     * When a string is used, exact value comparison is done.
     */
    include: string | RegExp | (string | RegExp)[];

    /**
     * This filter will exclude items that match *any* of the values in the array.
     * When a string is used, exact value comparison is done.
     */
    exclude?: string | RegExp | (string | RegExp)[];
}

export interface ContextValueFilterableTreeNodeV2 {
    readonly quickPickOptions: {
        readonly contextValues: Array<string>;
        readonly isLeaf: boolean;
    }
}

export type ContextValueFilterableTreeNode = ContextValueFilterableTreeNodeV2 | AzExtTreeItem;

// temporary type until we have the real type from RGs
export type ResourceGroupsItem = ContextValueFilterableTreeNode;

// #region pick tree item types

type CreateCallback<TNode = unknown> = () => TNode | Promise<TNode>;

type CreateOptions<TNode = unknown> = {
    label?: string;
    callback: CreateCallback<TNode>;
}

export interface GenericCreateQuickPickOptions {
    skipIfOne?: false;
    create?: CreateOptions;
}

export interface SkipIfOneQuickPickOptions {
    skipIfOne?: true;
    create?: never;
}

export type GenericQuickPickOptions = GenericCreateQuickPickOptions | SkipIfOneQuickPickOptions;

// #endregion pick tree item types
