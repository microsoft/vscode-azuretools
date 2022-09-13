/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../../index';
import { QuickPickWizardContext, getLastNode } from '../QuickPickWizardContext';
import { localize } from '../../../localize';
import { GenericQuickPickStep } from '../GenericQuickPickStep';

type CreateCallback<TNode = unknown> = (context: types.IActionContext) => TNode | Promise<TNode>;

type CreateOptions<TNode = unknown> = {
    label?: string;
    callback: CreateCallback<TNode>;
}

export interface CompatibilitySkipIfOneQuickPickOptions {
    skipIfOne?: true;
    create?: never;
}

export interface CompatibilityGenericQuickPickOptions {
    skipIfOne?: boolean;
    create?: CreateOptions;
}

export abstract class CompatibilityGenericQuickPickStep<TNode extends unknown, TContext extends QuickPickWizardContext<TNode>, TOptions extends CompatibilityGenericQuickPickOptions> extends GenericQuickPickStep<(TNode | CreateCallback), TContext, TOptions> {
    protected override async promptInternal(wizardContext: TContext): Promise<TNode | CreateCallback> {
        const picks = await this.getPicks(wizardContext);

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

                throw new types.UserCancelledError();
            }

            return selected.data;
        }
    }

    protected override async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<TNode | CreateCallback>[]> {
        const lastPickedItem: TNode | undefined = getLastNode(wizardContext);

        // TODO: if `lastPickedItem` is an `AzExtParentTreeItem`, should we clear its cache?
        const children = (await this.treeDataProvider.getChildren(lastPickedItem)) || [];

        const directChoices = children.filter(c => this.isDirectPick(c));
        const indirectChoices = children.filter(c => this.isIndirectPick(c));

        let promptChoices: (TNode | CreateCallback)[] = [];

        if (directChoices.length === 0) {
            if (indirectChoices.length === 0 && !this.pickOptions.create) {
                throw new types.NoResourceFoundError();
            } else {
                promptChoices = indirectChoices;
            }
        } else {
            promptChoices = directChoices;
        }

        const picks: types.IAzureQuickPickItem<TNode | CreateCallback>[] = [];
        for (const choice of promptChoices) {
            picks.push(await this.getQuickPickItem(choice));
        }

        if (this.pickOptions.create) {
            picks.push(this.getCreatePick(this.pickOptions.create));
        }


        return picks;
    }

    private getCreatePick(options: CreateOptions): types.IAzureQuickPickItem<CreateCallback> {
        return {
            label: options.label || localize('createQuickPickLabel', '$(add) Create...'),
            data: options.callback,
        };
    }
}
