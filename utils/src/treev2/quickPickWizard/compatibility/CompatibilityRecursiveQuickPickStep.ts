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
import { AzExtTreeItem } from "../../../tree/AzExtTreeItem";
import { isAzExtParentTreeItem, isAzExtTreeItem } from "../../../tree/isAzExtTreeItem";
import { isWrapper } from "../../../registerCommandWithTreeNodeUnwrapping";

export interface CompatibilityRecursiveQuickPickOptions extends ContextValueFilterQuickPickOptions {
    create?: types.CreateOptions;
}

/**
 * Recursive step which is compatible which adds create picks based if the node has {@link types.CompatibleQuickPickOptions.createChild quickPickOptions.createChild} defined.
 */
export class CompatibilityRecursiveQuickPickStep<TContext extends types.QuickPickWizardContext> extends CompatibilityContextValueQuickPickStep<TContext, CompatibilityRecursiveQuickPickOptions> {

    protected override async promptInternal(wizardContext: TContext): Promise<unknown> {
        const picks = await this.getPicks(wizardContext) as types.IAzureQuickPickItem<unknown>[];

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
                const callback = selected.data as unknown as types.CreateCallback<unknown>;

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

        // lastPickedItem might already be a tree item if the user picked a create callback
        const ti = isAzExtTreeItem(lastPickedItem) ? lastPickedItem : await this.treeDataProvider.getTreeItem(lastPickedItem) as AzExtTreeItem;

        if (this.pickFilter.isFinalPick(ti)) {
            // The last picked node matches the expected filter
            // No need to continue prompting
            return undefined;
        } else {
            const lastPickedItemTi = isWrapper(lastPickedItem) ? lastPickedItem.unwrap<AzExtTreeItem>() : lastPickedItem;
            // Need to keep going because the last picked node is not a match
            return {
                hideStepCount: true,
                promptSteps: [
                    new CompatibilityRecursiveQuickPickStep(this.treeDataProvider, {
                        ...this.pickOptions,
                        skipIfOne: isAzExtParentTreeItem(lastPickedItemTi) && !!lastPickedItemTi.createChildImpl,
                        create: (isAzExtParentTreeItem(lastPickedItemTi) && !!lastPickedItemTi.createChildImpl) ? {
                            callback: lastPickedItemTi.createChild.bind(lastPickedItemTi) as typeof lastPickedItemTi.createChild,
                            label: lastPickedItemTi.createNewLabel ?? localize('createNewItem', '$(plus) Create new {0}', lastPickedItemTi.childTypeLabel)
                        } : undefined
                    })
                ],
            };
        }
    }

    protected override async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<unknown>[]> {
        const picks: types.IAzureQuickPickItem<unknown | types.CreateCallback>[] = [];
        try {
            picks.push(...await super.getPicks(wizardContext));
        } catch (error) {
            if (error instanceof NoResourceFoundError && !!this.pickOptions.create) {
                // swallow NoResourceFoundError if create is defined, since we'll add a create pick
            } else {
                throw error;
            }
        }

        if (this.pickOptions.create) {
            picks.push(this.getCreatePick(this.pickOptions.create));
        }

        return picks as types.IAzureQuickPickItem<unknown>[];
    }

    private getCreatePick(options: types.CreateOptions): types.IAzureQuickPickItem<types.CreateCallback> {
        return {
            label: options.label || localize('createQuickPickLabel', '$(add) Create...'),
            data: options.callback,
        };
    }
}
