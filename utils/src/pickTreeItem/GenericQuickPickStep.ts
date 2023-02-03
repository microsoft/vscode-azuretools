/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import * as vscode from 'vscode';
import { getLastNode } from './getLastNode';
import { AzureWizardPromptStep } from '../wizard/AzureWizardPromptStep';
import { PickFilter } from './PickFilter';
import { localize } from '../localize';

export interface GenericQuickPickOptions {
    skipIfOne?: boolean;
}

export interface SkipIfOneQuickPickOptions extends GenericQuickPickOptions {
    skipIfOne?: true;
}

export abstract class GenericQuickPickStep<TContext extends types.QuickPickWizardContext, TOptions extends GenericQuickPickOptions> extends AzureWizardPromptStep<TContext> {
    public readonly supportsDuplicateSteps = true;

    protected readonly promptOptions: types.IAzureQuickPickOptions;
    protected readonly abstract pickFilter: PickFilter<vscode.TreeItem>;

    public constructor(
        protected readonly treeDataProvider: vscode.TreeDataProvider<unknown>,
        protected readonly pickOptions: TOptions,
        promptOptions?: types.IAzureQuickPickOptions
    ) {
        super();
        this.promptOptions = {
            noPicksMessage: localize('noMatchingResources', 'No matching resources found.'),
            ...promptOptions,
        };
    }

    public async prompt(wizardContext: TContext): Promise<void> {
        const pick = await this.promptInternal(wizardContext);
        wizardContext.pickedNodes.push(pick);
    }

    public undo(wizardContext: TContext): void {
        wizardContext.pickedNodes.pop();
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
                ...(this.promptOptions ?? {})
            });

            return selected.data;
        }
    }

    protected async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<unknown>[]> {
        const lastPickedItem: unknown | undefined = getLastNode(wizardContext);

        // TODO: if `lastPickedItem` is an `AzExtParentTreeItem`, should we clear its cache?
        const childElements = (await this.treeDataProvider.getChildren(lastPickedItem)) || [];
        const childItems = await Promise.all(childElements.map(async (childElement: unknown) => await this.treeDataProvider.getTreeItem(childElement)));
        const childPairs: [unknown, vscode.TreeItem][] = childElements.map((childElement: unknown, i: number) => [childElement, childItems[i]]);

        const finalChoices = childPairs.filter(([el, ti]) => this.pickFilter.isFinalPick(ti, el));
        const ancestorChoices = childPairs.filter(([el, ti]) => this.pickFilter.isAncestorPick(ti, el));

        let promptChoices: [unknown, vscode.TreeItem][] = [];
        if (finalChoices.length === 0) {
            if (ancestorChoices.length === 0) {
                // Don't throw and end the wizard, let user use back button instead
            } else {
                promptChoices = ancestorChoices;
            }
        } else {
            promptChoices = finalChoices;
        }

        const picks: types.IAzureQuickPickItem<unknown>[] = [];
        for (const choice of promptChoices) {
            picks.push(await this.getQuickPickItem(...choice));
        }

        return picks;
    }

    protected async getQuickPickItem(element: unknown, item: vscode.TreeItem): Promise<types.IAzureQuickPickItem<unknown>> {
        return {
            label: ((item.label as vscode.TreeItemLabel)?.label || item.label) as string,
            description: item.description as string,
            data: element,
        };
    }
}
