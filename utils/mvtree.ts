/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AppResource } from './hostapi';

/**
 * This interface describes required properties in order to support the quick pick-through-the-tree
 * logic. It is not required to be implemented, but the quick pick behavior will ignore the
 * branch of the tree if these properties are not present.
 */
export interface QuickPickableModelNode {
    /**
     * An array of context values.
     */
    readonly contextValuesArray: string[];

    /**
     * Whether or not this node is a leaf in the overall tree
     */
    readonly isLeafNode: boolean;
}

/**
 * This interface describes a provider for a subsection of the Azure Resources tree--i.e., a branch
 * in that tree.
 *
 * This is largely identical to {@link vscode.TreeDataProvider}.
 */
export interface BranchDataProvider<T extends Partial<QuickPickableModelNode>> extends vscode.TreeDataProvider<T> {
    /**
     * Get the trunk element corresponding to the `resource` parameter. In essence, `resource`
     * and the returned `T` object would occupy the same location in the tree view.
     * @param resource The resource fetched by the Azure Resources extension.
     * @return The model object corresponding to the resource fetched by the Azure Resources extension.
     */
    getTrunkElement(resource: AppResource2): vscode.ProviderResult<T>;

    /**
     * Get the children of `element`. `element` will never be falsy.
     *
     * This is otherwise identical to {@link vscode.TreeDataProvider.getChildren}, but redefined
     * to reflect that `element` will always have a value.
     * @param element The element from which the provider gets children.
     * @return Children of `element`.
     */
    getChildren(element: T): vscode.ProviderResult<T[]>;

    /**
     * An optional event to signal that an element has changed.
     * This will trigger the view to update the changed element and its children recursively (if shown).
     *
     * This is otherwise identical to {@link vscode.TreeDataProvider.onDidChangeTreeData}, but redefined
     * to reflect that the event must always send a value in the event arguments.
     */
    onDidChangeTreeData?: vscode.Event<T>
}

// TODO
export type AppResource2 = AppResource;
