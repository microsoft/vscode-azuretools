/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import { getLastNode } from './common/getLastNode';
import { ContextValueFilterQuickPickOptions, ContextValueQuickPickStep } from './ContextValueQuickPickStep';
import { localize } from '../../localize';
import { NoResourceFoundError } from '../../errors';

type CreateCallback = <TNode extends unknown>() => TNode | Promise<TNode>;
interface CreateQuickPickOptions extends ContextValueFilterQuickPickOptions {
    skipIfOne?: never; // Not allowed in CreateQuickPickStep
    createLabel?: string;
    createCallback: CreateCallback;
}

export class CreateQuickPickStep<TContext extends types.QuickPickWizardContext> extends ContextValueQuickPickStep<TContext, CreateQuickPickOptions> {
    public override async prompt(wizardContext: TContext): Promise<void> {
        await super.prompt(wizardContext);

        const lastNode = getLastNode<unknown | CreateCallback>(wizardContext);
        if (typeof lastNode === 'function') {
            // If the last node is a function, pop it off the list and execute it
            const callback = wizardContext.pickedNodes.pop() as unknown as CreateCallback;
            wizardContext.pickedNodes.push(await callback());
        }
    }

    protected override async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<unknown>[]> {
        const picks: types.IAzureQuickPickItem<unknown | types.CreateCallback>[] = [];
        try {
            picks.push(...await super.getPicks(wizardContext));
        } catch (error) {
            if (error instanceof NoResourceFoundError) {
                // swallow NoResourceFoundError if create is defined, since we'll add a create pick
            } else {
                throw error;
            }
        }

        picks.push(this.getCreatePick());
        return picks as types.IAzureQuickPickItem<unknown>[];
    }

    private getCreatePick(): types.IAzureQuickPickItem<CreateCallback> {
        return {
            label: this.pickOptions.createLabel || localize('createQuickPickLabel', '$(add) Create...'),
            data: this.pickOptions.createCallback,
        };
    }
}
