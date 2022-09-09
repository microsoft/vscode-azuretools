/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as vscode from 'vscode';
import { getLastNode } from './QuickPickWizardContext';
import { isAzExtParentTreeItem } from '../../tree/InternalInterfaces';
import { isContextValueFilterableTreeNodeV2 } from './ContextValueQuickPickStep';
import { GenericQuickPickStep, SkipIfOneQuickPickOptions } from './GenericQuickPickStep';

interface FindByIdQuickPickOptions extends SkipIfOneQuickPickOptions {
    id: string;
    skipIfOne?: true;
}

export class FindByIdQuickPickStep<TNode extends types.FindableByIdTreeNode, TContext extends types.QuickPickWizardContext<TNode>> extends GenericQuickPickStep<TNode, TContext, FindByIdQuickPickOptions> {
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

            return this.pickOptions.id.startsWith(node.id);
        } else {
            if (!isAzExtParentTreeItem(node)) {
                return false;
            }

            return this.pickOptions.id.startsWith(node.fullId);
        }
    }

    protected override isDirectPick(node: TNode): boolean {
        if (isFindableByIdTreeNodeV2(node)) {
            return this.pickOptions.id === node.id;
        } else {
            return this.pickOptions.id === node.fullId;
        }
    }
}

function isFindableByIdTreeNodeV2(maybeNode: unknown): maybeNode is types.FindableByIdTreeNodeV2 {
    if (!isContextValueFilterableTreeNodeV2(maybeNode)) {
        return false;
    }

    if (typeof maybeNode === 'object') {
        return typeof (maybeNode as types.FindableByIdTreeNodeV2).id === 'string' && !!(maybeNode as types.FindableByIdTreeNodeV2).id;
    }

    return false;
}
