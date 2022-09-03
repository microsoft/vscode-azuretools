/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as vscode from 'vscode';
import { getLastNode, QuickPickWizardContext } from './QuickPickWizardContext';
import { AzureWizardPromptStep } from '../../wizard/AzureWizardPromptStep';
import { NoResourceFoundError } from '../../errors';
import { parseError } from '../../parseError';

export interface GenericQuickPickOptions {
    skipIfOne?: boolean;
    fallbackToAll?: boolean;
}

export interface SkipIfOneQuickPickOptions extends GenericQuickPickOptions {
    skipIfOne?: true;
}

export abstract class GenericQuickPickStep<TNode extends unknown, TContext extends QuickPickWizardContext<TNode>, TOptions extends GenericQuickPickOptions> extends AzureWizardPromptStep<TContext> {
    public readonly supportsDuplicateSteps = true;

    public constructor(
        protected readonly treeDataProvider: vscode.TreeDataProvider<TNode>,
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

    protected async promptInternal(wizardContext: TContext): Promise<TNode> {
        const picks = await this.getPicks(wizardContext);

        if (picks.length === 1 && this.pickOptions.skipIfOne) {
            return picks[0].data;
        } else {
            const selected = await wizardContext.ui.showQuickPick(picks, { /* TODO: options */ });
            return selected.data;
        }
    }

    protected async getPicks(wizardContext: TContext): Promise<types.IAzureQuickPickItem<TNode>[]> {
        const lastPickedItem: TNode | undefined = getLastNode(wizardContext);

        // TODO: if `lastPickedItem` is an `AzExtParentTreeItem`, should we clear its cache?
        const children = (await this.treeDataProvider.getChildren(lastPickedItem)) || [];

        const directChoices = children.filter(c => this.isDirectPick(c));
        const indirectChoices = children.filter(c => this.isIndirectPick(c));



        let promptChoices: TNode[];
        if (directChoices.length === 0) {
            if (indirectChoices.length === 0) {
                if (this.pickOptions.fallbackToAll) {
                    promptChoices = children;
                } else {
                    throw new NoResourceFoundError();
                }
            } else {
                promptChoices = indirectChoices;
            }
        } else {
            promptChoices = directChoices;
        }

        const picks: types.IAzureQuickPickItem<TNode>[] = [];
        for (const choice of promptChoices) {
            picks.push(await this.getQuickPickItem(choice));
        }

        return picks;
    }

    /**
     * Filters for nodes that match the final target.
     * @param node The node to apply the filter to
     */
    protected abstract isDirectPick(node: TNode): boolean;

    /**
     * Filters for nodes that could have a descendant matching the final target.
     * @param node The node to apply the filter to
     */
    protected abstract isIndirectPick(node: TNode): boolean;

    private async getQuickPickItem(resource: TNode): Promise<types.IAzureQuickPickItem<TNode>> {
        const treeItem = await Promise.resolve(this.treeDataProvider.getTreeItem(resource));

        return {
            label: ((treeItem.label as vscode.TreeItemLabel)?.label || treeItem.label) as string,
            description: treeItem.description as string,
            data: resource,
        };
    }
}
