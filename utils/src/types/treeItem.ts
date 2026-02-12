/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type * as vscodeTypes from 'vscode';
import type { MarkdownString, TreeItemCollapsibleState } from 'vscode';
import type { IActionContext } from './actionContext';
import type { ISubscriptionContext } from './subscription';

export type TreeItemIconPath = vscodeTypes.IconPath;

export interface RunWithTemporaryDescriptionOptions {
    description: string;
    /**
     * If true, runWithTemporaryDescription will not call refresh or refreshUIOnly on the tree item.
     */
    softRefresh?: boolean;
}

export interface ILoadingTreeContext extends IActionContext {
    /**
     * A custom message to overwrite the default message while loading
     */
    loadingMessage?: string;
    /**
     * Number of seconds to delay before showing the progress message (default is 2)
     */
    loadingMessageDelay?: number;
}

export interface IFindTreeItemContext extends ILoadingTreeContext {
    /**
     * If true, this will load all children when searching for the tree item
     */
    loadAll?: boolean;
}

export interface ITreeItemPickerContext extends IActionContext {
    canPickMany?: boolean;
    suppressCreatePick?: boolean;
    ignoreFocusOut?: boolean;
    noItemFoundErrorMessage?: string;
}

// Forward declarations for class types used in interfaces
// These reference the actual classes defined in src/tree/
import type { AzExtTreeItem } from '../tree/AzExtTreeItem';
import type { AzExtParentTreeItem } from '../tree/AzExtParentTreeItem';
import type { AzExtTreeDataProvider } from '../tree/AzExtTreeDataProvider';

/**
 * AzExtTreeItem properties that can be called but should not be overridden
 */
export interface SealedAzExtTreeItem {
    readonly fullId: string;
    readonly parent?: AzExtParentTreeItem;
    readonly treeDataProvider: AzExtTreeDataProvider;
    readonly subscription: ISubscriptionContext;
    readonly valuesToMask: string[];
    readonly collapsibleState: TreeItemCollapsibleState | undefined;
    suppressMaskLabel?: boolean;
    refresh(context: IActionContext): Promise<void>;
    deleteTreeItem(context: IActionContext): Promise<void>;
    runWithTemporaryDescription(context: IActionContext, description: string, callback: () => Promise<void>): Promise<void>;
    runWithTemporaryDescription(context: IActionContext, options: RunWithTemporaryDescriptionOptions, callback: () => Promise<void>): Promise<void>;
}

/**
 * AzExtTreeItem properties that can be overridden
 */
export interface AbstractAzExtTreeItem {
    id?: string;
    label: string;
    description?: string;
    iconPath?: TreeItemIconPath;
    commandId?: string;
    tooltip?: string;
    initialCollapsibleState?: TreeItemCollapsibleState;
    commandArgs?: unknown[];
    contextValue: string;
    loadMoreChildrenImpl?(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;
    hasMoreChildrenImpl?(): boolean;
    createChildImpl?(context: ICreateChildImplContext): Promise<AzExtTreeItem>;
    compareChildrenImpl?(item1: AzExtTreeItem, item2: AzExtTreeItem): number;
    pickTreeItemImpl?(expectedContextValues: (string | RegExp)[], context: IActionContext): AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>;
    deleteTreeItemImpl?(context: IActionContext): Promise<void>;
    refreshImpl?(context: IActionContext): Promise<void>;
    isAncestorOfImpl?(contextValue: string | RegExp): boolean;
    resolveTooltip?(): Promise<string | MarkdownString>;
}

export type IAzExtTreeItem = AbstractAzExtTreeItem & SealedAzExtTreeItem;

export interface IAzExtParentTreeItem extends IAzExtTreeItem {
    loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;
    hasMoreChildrenImpl(): boolean;
}

export interface IGenericTreeItemOptions {
    id?: string;
    label: string;
    description?: string;
    iconPath?: TreeItemIconPath;
    commandId?: string;
    contextValue: string;
    tooltip?: string;
    includeInTreeItemPicker?: boolean;
}

export interface IInvalidTreeItemOptions {
    label: string;
    contextValue: string;
    description?: string;
    data?: unknown;
}

export interface ICreateChildImplContext extends IActionContext {
    showCreatingTreeItem(label: string): void;
    advancedCreation?: boolean;
}
