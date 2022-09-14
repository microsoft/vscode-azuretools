/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IAzureQuickPickItem, IWizardOptions } from "../../../../index";
import type { ContextValueFilterableTreeNode, CreateCallback, CreateOptions } from "../../../../hostapi.v2";
import { isAzExtParentTreeItem } from "../../../tree/InternalInterfaces";
import { isContextValueFilterableTreeNodeV2 } from "../ContextValueQuickPickStep";
import { QuickPickWizardContext, getLastNode } from "../QuickPickWizardContext";
import { CompatibilityContextValueFilterQuickPickOptions, CompatibilityContextValueQuickPickStep } from './CompatibilityContextValueQuickPickStep';
import { localize } from "../../../localize";
import { NoResourceFoundError, UserCancelledError } from "../../../errors";

export interface CompatibilityRecursiveQuickPickOptions extends CompatibilityContextValueFilterQuickPickOptions {
    create?: CreateOptions;
}

export class CompatibilityRecursiveQuickPickStep<TNode extends ContextValueFilterableTreeNode, TContext extends QuickPickWizardContext<TNode>> extends CompatibilityContextValueQuickPickStep<TNode, TContext, CompatibilityRecursiveQuickPickOptions> {

    protected override async promptInternal(wizardContext: TContext): Promise<TNode> {
        const picks = await this.getPicks(wizardContext) as IAzureQuickPickItem<TNode>[];

        if (picks.length === 1 && this.pickOptions.skipIfOne) {
            return picks[0].data;
        } else {
            const selected = await wizardContext.ui.showQuickPick(picks, {
                /* TODO: options */
                /* TODO: set id here so recently picked items appear at the top */
            });

            // check if the last picked item is a create callback
            if (typeof selected.data === 'function') {
                // If the last node is a function, pop it off the list and execute it
                const callback = selected.data as unknown as CreateCallback<TNode>;

                // context passed to callback must have the same `ui` as the wizardContext
                // to prevent the wizard from being cancelled unexpectedly
                const createdPick = await callback?.(wizardContext);

                if (createdPick) {
                    return createdPick;
                }

                throw new UserCancelledError();
            }

            return selected.data;
        }
    }

    protected override async getPicks(wizardContext: TContext): Promise<IAzureQuickPickItem<TNode>[]> {
        const lastPickedItem: TNode | undefined = getLastNode(wizardContext);

        // TODO: if `lastPickedItem` is an `AzExtParentTreeItem`, should we clear its cache?
        const children = (await this.treeDataProvider.getChildren(lastPickedItem)) || [];

        const directChoices = children.filter(c => this.isDirectPick(c));
        const indirectChoices = children.filter(c => this.isIndirectPick(c));

        let promptChoices: (TNode | CreateCallback)[] = [];

        if (directChoices.length === 0) {
            if (indirectChoices.length === 0 && !this.pickOptions.create) {
                throw new NoResourceFoundError();
            } else {
                promptChoices = indirectChoices;
            }
        } else {
            promptChoices = directChoices;
        }

        const picks: IAzureQuickPickItem<TNode | CreateCallback>[] = [];
        for (const choice of promptChoices) {
            picks.push(await this.getQuickPickItem(choice as TNode));
        }

        if (this.pickOptions.create) {
            picks.push(this.getCreatePick(this.pickOptions.create));
        }


        return picks as IAzureQuickPickItem<TNode>[];
    }

    private getCreatePick(options: CreateOptions): IAzureQuickPickItem<CreateCallback> {
        return {
            label: options.label || localize('createQuickPickLabel', '$(add) Create...'),
            data: options.callback,
        };
    }

    public async getSubWizard(wizardContext: TContext): Promise<IWizardOptions<TContext> | undefined> {
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
                    new CompatibilityRecursiveQuickPickStep(this.treeDataProvider, {
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
