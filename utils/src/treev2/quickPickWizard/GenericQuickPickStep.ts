/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as vscode from 'vscode';
import { getLastNode } from './QuickPickWizardContext';
import { AzureWizardPromptStep } from '../../wizard/AzureWizardPromptStep';
import { NoResourceFoundError } from '../../errors';
import { parseError } from '../../parseError';
import { PickFilter } from './common/PickFilter';

export interface GenericQuickPickOptions {
    skipIfOne?: boolean;
}

export interface SkipIfOneQuickPickOptions extends GenericQuickPickOptions {
    skipIfOne?: true;
}

export abstract class GenericQuickPickStep<TContext extends types.QuickPickWizardContext, TOptions extends GenericQuickPickOptions> extends AzureWizardPromptStep<TContext> {
    public readonly supportsDuplicateSteps = true;

    protected readonly abstract pickFilter: PickFilter<vscode.TreeItem>;

    public constructor(
        protected readonly treeDataProvider: vscode.TreeDataProvider<unknown>,
        protected readonly pickOptions: TOptions
    ) {
        super();
    }

    public async prompt(wizardContext: TContext): Promise<void> {
        try {
            const pick = await this.promptInternal(wizardContext);
            wizardContext.pickedNodes.push(pick);
        } catch (err) {
            const error = parseError(err);
            if (error.errorType === 'GoBackError') {
                // Instead of wiping out a property value, which is the default wizard behavior for `GoBackError`, pop the most recent
                // value off from the provenance of the picks
                wizardContext.pickedNodes.pop();
            }

            // And rethrow
            throw err;
        }
    }

    public shouldPrompt(_wizardContext: TContext): boolean {
        return true;
    }

    protected async promptInternal(wizardContext: TContext): Promise<unknown> {
        const picks = await this.getPicks(wizardContext);

        if (picks.length === 1 && this.pickOptions.skipIfOne) {
            return picks[0].data;
        } else {
            const selected = await wizardContext.ui.showQuickPick(picks, {
                /* TODO: options */
                /* TODO: set id here so recently picked items appear at the top */
            });

            return selected.data;
        }
    }

    protected async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<unknown>[]> {
        const lastPickedItem: unknown | undefined = getLastNode(wizardContext);

        // TODO: if `lastPickedItem` is an `AzExtParentTreeItem`, should we clear its cache?
        const childNodes = (await this.treeDataProvider.getChildren(lastPickedItem)) || [];
        const childItems = await Promise.all(childNodes.map(async (childElement: unknown) => await this.treeDataProvider.getTreeItem(childElement)));
        const childPairs: [unknown, vscode.TreeItem][] = childNodes.map((childElement: unknown, i: number) => [childElement, childItems[i]]);

        const directChoices = childPairs.filter(([, ti]) => this.pickFilter.isDirectPick(ti));
        const indirectChoices = childPairs.filter(([, ti]) => this.pickFilter.isIndirectPick(ti));

        let promptChoices: [unknown, vscode.TreeItem][];
        if (directChoices.length === 0) {
            if (indirectChoices.length === 0) {
                throw new NoResourceFoundError();
            } else {
                promptChoices = indirectChoices;
            }
        } else {
            promptChoices = directChoices;
        }

        const picks: types.IAzureQuickPickItem<unknown>[] = [];
        for (const choice of promptChoices) {
            picks.push(await this.getQuickPickItem(...choice));
        }

        return picks;
    }

    private async getQuickPickItem(node: unknown, item: vscode.TreeItem): Promise<types.IAzureQuickPickItem<unknown>> {
        return {
            label: ((item.label as vscode.TreeItemLabel)?.label || item.label) as string,
            description: item.description as string,
            data: node,
        };
    }
}
