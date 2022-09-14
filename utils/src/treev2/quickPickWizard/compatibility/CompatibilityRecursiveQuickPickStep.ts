/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from "../../../../index";
import { getLastNode } from "../QuickPickWizardContext";
import { CompatibilityContextValueQuickPickStep } from './CompatibilityContextValueQuickPickStep';
import { localize } from "../../../localize";
import { NoResourceFoundError, UserCancelledError } from "../../../errors";
import type { ContextValueFilterQuickPickOptions } from "../ContextValueQuickPickStep";

export interface CompatibilityRecursiveQuickPickOptions extends ContextValueFilterQuickPickOptions {
    create?: types.CreateOptions;
}

/**
 * Recursive step which is compatible which adds create picks based if the node has {@link types.CompatibleQuickPickOptions.createChild quickPickOptions.createChild} defined.
 */
export class CompatibilityRecursiveQuickPickStep<TNode extends types.CompatibleContextValueFilterableTreeNode, TContext extends types.QuickPickWizardContext<TNode>> extends CompatibilityContextValueQuickPickStep<TNode, TContext, CompatibilityRecursiveQuickPickOptions> {

    protected override async promptInternal(wizardContext: TContext): Promise<TNode> {
        const picks = await this.getPicks(wizardContext) as types.IAzureQuickPickItem<TNode>[];

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
                const callback = selected.data as unknown as types.CreateCallback<TNode>;

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
            // Need to keep going because the last picked node is not a match
            return {
                hideStepCount: true,
                promptSteps: [
                    new CompatibilityRecursiveQuickPickStep(this.treeDataProvider, {
                        ...this.pickOptions,
                        skipIfOne: !lastPickedItem.quickPickOptions.createChild,
                        create: lastPickedItem.quickPickOptions.createChild,
                    })
                ],
            };
        }
    }

    protected override async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<TNode>[]> {
        const lastPickedItem: TNode | undefined = getLastNode(wizardContext);

        // TODO: if `lastPickedItem` is an `AzExtParentTreeItem`, should we clear its cache?
        const children = (await this.treeDataProvider.getChildren(lastPickedItem)) || [];

        const directChoices = children.filter(c => this.isDirectPick(c));
        const indirectChoices = children.filter(c => this.isIndirectPick(c));

        let promptChoices: (TNode | types.CreateCallback)[] = [];

        if (directChoices.length === 0) {
            if (indirectChoices.length === 0 && !this.pickOptions.create) {
                throw new NoResourceFoundError();
            } else {
                promptChoices = indirectChoices;
            }
        } else {
            promptChoices = directChoices;
        }

        const picks: types.IAzureQuickPickItem<TNode | types.CreateCallback>[] = [];
        for (const choice of promptChoices) {
            picks.push(await this.getQuickPickItem(choice as TNode));
        }

        if (this.pickOptions.create) {
            picks.push(this.getCreatePick(this.pickOptions.create));
        }


        return picks as types.IAzureQuickPickItem<TNode>[];
    }

    private getCreatePick(options: types.CreateOptions): types.IAzureQuickPickItem<types.CreateCallback> {
        return {
            label: options.label || localize('createQuickPickLabel', '$(add) Create...'),
            data: options.callback,
        };
    }
}
