/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isWrapper, Wrapper } from "@microsoft/vscode-azureresources-api";
import * as vscode from "vscode";
import * as types from "../../../../index";
import { NoResourceFoundError, UserCancelledError } from "../../../errors";
import { AzExtTreeItem } from "../../../tree/AzExtTreeItem";
import { isAzExtParentTreeItem, isAzExtTreeItem } from "../../../tree/isAzExtTreeItem";
import { getLastNode } from "../../getLastNode";
import { CompatibilityContextValueQuickPickStep } from './CompatibilityContextValueQuickPickStep';

type CreateCallback<TNode = unknown> = (context: types.IActionContext) => TNode | Promise<TNode>;

type CreateOptions<TNode = unknown> = {
    label?: string;
    callback: CreateCallback<TNode>;
}

interface CompatibilityRecursiveQuickPickOptions extends types.ContextValueFilterQuickPickOptions {
    create?: CreateOptions;
}

/**
 * Recursive step which is compatible which adds create picks based if the node has {@link types.CompatibleQuickPickOptions.createChild quickPickOptions.createChild} defined.
 */
export class CompatibilityRecursiveQuickPickStep<TContext extends types.QuickPickWizardContext & types.ITreeItemPickerContext> extends CompatibilityContextValueQuickPickStep<TContext, CompatibilityRecursiveQuickPickOptions> {

    protected override async promptInternal(wizardContext: TContext): Promise<unknown> {

        const lastPickedItem = getLastNode(wizardContext);
        const lastPickedItemTi = isWrapper(lastPickedItem) ? lastPickedItem.unwrap<AzExtTreeItem>() : lastPickedItem;

        if (isAzExtParentTreeItem(lastPickedItemTi)) {
            this.promptOptions.placeHolder = vscode.l10n.t('Select {0}', lastPickedItemTi.childTypeLabel!);
            this.promptOptions.stepName = `treeItemPicker|${lastPickedItemTi.contextValue}`;
            this.promptOptions.noPicksMessage = wizardContext.noItemFoundErrorMessage ?? this.promptOptions.noPicksMessage;
            this.promptOptions.ignoreFocusOut = wizardContext.ignoreFocusOut;
        }

        const shouldAddCreatePick = isAzExtParentTreeItem(lastPickedItemTi) && !!lastPickedItemTi.createChildImpl && !!lastPickedItemTi.childTypeLabel && !wizardContext.suppressCreatePick;

        this.pickOptions.create = shouldAddCreatePick ? {
            callback: lastPickedItemTi.createChild.bind(lastPickedItemTi) as typeof lastPickedItemTi.createChild,
            label: lastPickedItemTi.createNewLabel ?? vscode.l10n.t('$(plus) Create new {0}...', lastPickedItemTi.childTypeLabel!)
        } : undefined;

        const picks = await this.getPicks(wizardContext) as types.IAzureQuickPickItem<unknown>[];

        if (picks.length === 1 && this.pickOptions.skipIfOne && typeof picks[0].data !== 'function') {
            return picks[0].data;
        } else {
            const selected = await wizardContext.ui.showQuickPick(picks, {
                ...(this.promptOptions ?? {}),
            });

            // check if the last picked item is a create callback
            if (typeof selected.data === 'function') {
                // If the last node is a function, pop it off the list and execute it
                const callback = selected.data as unknown as CreateCallback<unknown>;

                // context passed to callback must have the same `ui` as the wizardContext
                // to prevent the wizard from being cancelled unexpectedly
                const createdTreeItem = await callback?.(wizardContext) as AzExtTreeItem;

                // convert created AzExtTreeItem to a BranchDataItem so the wizard can get its children in the next step
                const picks = await this.getPicks(wizardContext) as types.IAzureQuickPickItem<unknown>[];
                const createdPick = picks.find((pick) => {
                    return (pick.data as Wrapper).unwrap<AzExtTreeItem>().fullId === createdTreeItem.fullId;
                });

                if (createdPick) {
                    return createdPick.data;
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

        if (this.pickFilter.isFinalPick(ti, lastPickedItem)) {
            // The last picked node matches the expected filter
            // No need to continue prompting
            return undefined;
        } else {
            // Need to keep going because the last picked node is not a match
            return {
                hideStepCount: true,
                promptSteps: [
                    new CompatibilityRecursiveQuickPickStep(this.treeDataProvider, this.pickOptions)
                ],
            };
        }
    }

    protected override async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<unknown>[]> {
        const picks: types.IAzureQuickPickItem<unknown | CreateCallback>[] = [];
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

    private getCreatePick(options: CreateOptions): types.IAzureQuickPickItem<CreateCallback> {
        return {
            label: options.label || vscode.l10n.t('$(add) Create...'),
            data: options.callback,
        };
    }
}
