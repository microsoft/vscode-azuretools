/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ContextValueFilterableTreeNode, CreateOptions } from '../../../hostapi.v2';
import * as types from '../../../index';
import { isAzExtParentTreeItem } from '../../tree/InternalInterfaces';
import { ContextValueFilterQuickPickOptions, ContextValueQuickPickStep, isContextValueFilterableTreeNodeV2 } from './ContextValueQuickPickStep';
import { getLastNode, QuickPickWizardContext } from './QuickPickWizardContext';

export class RecursiveQuickPickStep<TNode extends ContextValueFilterableTreeNode, TContext extends QuickPickWizardContext<TNode>> extends ContextValueQuickPickStep<TNode, TContext, ContextValueFilterQuickPickOptions> {
    public async getSubWizard(wizardContext: TContext): Promise<types.IWizardOptions<TContext> | undefined> {
        const lastPickedItem = getLastNode(wizardContext);

        if (!lastPickedItem) {
            // Something went wrong, no node was chosen
            throw new Error('No node was set after prompt step.');
        }

        if (super.isDirectPick(lastPickedItem)) {
            // The last picked node matches the expected filter
            // No need to continue prompting
            return undefined;
        } else {

            const create = this.getCreateOptions(lastPickedItem);
            // Need to keep going because the last picked node is not a match
            return {
                hideStepCount: true,
                promptSteps: [
                    new RecursiveQuickPickStep(this.treeDataProvider, {
                        ...this.pickOptions,
                        skipIfOne: !create,
                        create,
                    })
                ],
            };
        }
    }

    private getCreateOptions(node: TNode): CreateOptions | undefined {
        if (isContextValueFilterableTreeNodeV2(node)) {
            return node.quickPickOptions.createChild;
        }

        if (isAzExtParentTreeItem(node)) {
            return {
                label: node.createNewLabel,
                callback: async () => {
                    node.createChild.bind(node) as typeof node.createChild
                },
            }
        }

        return undefined;
    }
}
