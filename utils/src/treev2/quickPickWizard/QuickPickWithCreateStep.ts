/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import { getLastNode } from './QuickPickWizardContext';
import { ContextValueFilterQuickPickOptions, ContextValueQuickPickStep } from './ContextValueQuickPickStep';
import { localize } from '../../localize';

type CreateCallback = <TNode extends types.ContextValueFilterableTreeNode>() => TNode | Promise<TNode>;
interface CreateQuickPickOptions extends ContextValueFilterQuickPickOptions {
    skipIfOne?: never; // Not allowed in CreateQuickPickStep
    createLabel?: string;
    createCallback: CreateCallback;
}

export class CreateQuickPickStep<TNode extends types.ContextValueFilterableTreeNode, TContext extends types.QuickPickWizardContext<TNode>> extends ContextValueQuickPickStep<TNode, TContext, CreateQuickPickOptions> {
    public override async prompt(wizardContext: TContext): Promise<void> {
        await super.prompt(wizardContext);

        const lastNode = getLastNode(wizardContext) as (TNode | CreateCallback);
        if (typeof lastNode === 'function') {
            // If the last node is a function, pop it off the list and execute it
            const callback = wizardContext.pickedNodes.pop() as unknown as CreateCallback;
            wizardContext.pickedNodes.push(await callback());
        }
    }

    protected override async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<TNode>[]> {
        const picks: types.IAzureQuickPickItem<TNode | CreateCallback>[] = await super.getPicks(wizardContext);
        picks.push(this.getCreatePick());
        return picks as types.IAzureQuickPickItem<TNode>[];
    }

    private getCreatePick(): types.IAzureQuickPickItem<CreateCallback> {
        return {
            label: this.pickOptions.createLabel || localize('createQuickPickLabel', '$(add) Create...'),
            data: this.pickOptions.createCallback,
        };
    }
}
