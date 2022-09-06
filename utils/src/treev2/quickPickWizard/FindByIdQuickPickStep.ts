/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as vscode from 'vscode';
import { getLastNode, QuickPickWizardContext } from './QuickPickWizardContext';
import { isAzExtParentTreeItem } from '../../tree/InternalInterfaces';
import { ContextValueFilterableTreeNodeV2, isContextValueFilterableTreeNodeV2 } from './ContextValueQuickPickStep';
import { GenericQuickPickStep, SkipIfOneQuickPickOptions } from './GenericQuickPickStep';

interface FindableByIdTreeNodeV2 extends ContextValueFilterableTreeNodeV2 {
    id: vscode.Uri;
}

export type FindableByIdTreeNode = FindableByIdTreeNodeV2 | types.AzExtTreeItem;

interface FindByIdQuickPickOptions extends SkipIfOneQuickPickOptions {
    id: string | vscode.Uri;
    skipIfOne?: true;
}

export class FindByIdQuickPickStep<TNode extends FindableByIdTreeNode, TContext extends QuickPickWizardContext<TNode>> extends GenericQuickPickStep<TNode, TContext, FindByIdQuickPickOptions> {
    public constructor(tdp: vscode.TreeDataProvider<TNode>, options: FindByIdQuickPickOptions) {
        super(
            tdp,
            {
                ...options,
                skipIfOne: true, // Find-by-id is always skip-if-one
            }
        );
    }

    public async getSubWizard(wizardContext: TContext): Promise<types.IWizardOptions<TContext> | undefined> {
        // TODO: this code is nearly identical to `RecursiveQuickPickStep`, but this class can't inherit from it because it's
        // not at all based on context value for filtering
        const lastPickedItem = getLastNode(wizardContext);

        if (!lastPickedItem) {
            // Something went wrong, no node was chosen
            throw new Error('No node was set after prompt step.');
        }

        if (this.isDirectPick(lastPickedItem)) {
            // The last picked node matches the expected ID
            // No need to continue prompting
            return undefined;
        } else {
            // Need to keep going because the last picked node is not a match
            return {
                hideStepCount: true,
                promptSteps: [
                    new FindByIdQuickPickStep(this.treeDataProvider, this.pickOptions)
                ],
            };
        }
    }

    protected override isIndirectPick(node: TNode): boolean {
        if (isFindableByIdTreeNodeV2(node)) {
            if (node.quickPickOptions.isLeaf) {
                return false;
            }

            if (typeof this.pickOptions.id === 'string') {
                // Append '/' to 'treeItem.fullId' when checking 'startsWith' to ensure its actually an ancestor, rather than a treeItem at the same level that _happens_ to start with the same id
                // For example, two databases named 'test' and 'test1' as described in this issue: https://github.com/Microsoft/vscode-cosmosdb/issues/488
                return this.pickOptions.id.startsWith(`${node.id.toString()}/`);
            } else {
                return this.pickOptions.id.scheme === node.id.scheme &&
                    this.pickOptions.id.authority === node.id.authority &&
                    this.pickOptions.id.path.startsWith(`${node.id.path}/`);
            }
        } else {
            if (!isAzExtParentTreeItem(node)) {
                return false;
            }

            if (typeof this.pickOptions.id === 'string') {
                return this.pickOptions.id.startsWith(`${node.fullId}/`);
            } else {
                return this.pickOptions.id.toString().startsWith(`${node.fullId}/`);
            }
        }
    }

    protected override isDirectPick(node: TNode): boolean {
        if (isFindableByIdTreeNodeV2(node)) {
            if (typeof this.pickOptions.id === 'string') {
                return this.pickOptions.id === node.id.toString();
            } else {
                return this.pickOptions.id.scheme === node.id.scheme &&
                    this.pickOptions.id.authority === node.id.authority &&
                    this.pickOptions.id.path === node.id.path;
            }
        } else {
            if (typeof this.pickOptions.id === 'string') {
                return this.pickOptions.id === node.fullId;
            } else {
                return this.pickOptions.id.toString() === node.fullId;
            }
        }
    }
}

function isFindableByIdTreeNodeV2(maybeNode: unknown): maybeNode is FindableByIdTreeNodeV2 {
    if (!isContextValueFilterableTreeNodeV2(maybeNode)) {
        return false;
    }

    if (typeof maybeNode === 'object') {
        const idAsUri = (maybeNode as FindableByIdTreeNodeV2).id as vscode.Uri;

        return typeof idAsUri === 'object' &&
            typeof idAsUri.scheme === 'string' &&
            typeof idAsUri.authority === 'string' &&
            typeof idAsUri.path === 'string';
    }

    return false;
}
