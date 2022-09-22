/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as vscode from 'vscode';
import { getLastNode } from './QuickPickWizardContext';
import { GenericQuickPickStep, SkipIfOneQuickPickOptions } from './GenericQuickPickStep';

interface FindByIdQuickPickOptions extends SkipIfOneQuickPickOptions {
    id: string;
    skipIfOne?: true;
}

export class FindByIdQuickPickStep<TContext extends types.QuickPickWizardContext> extends GenericQuickPickStep<TContext, FindByIdQuickPickOptions> {
    public constructor(tdp: vscode.TreeDataProvider<unknown>, options: FindByIdQuickPickOptions) {
        super(
            tdp,
            {
                ...options,
                skipIfOne: true, // Find-by-id is always skip-if-one
            }
        );
    }

    public async getSubWizard(wizardContext: TContext): Promise<types.IWizardOptions<TContext> | undefined> {
        // TODO: this code is nearly identical to `RecursiveQuickPickStep`, but this class can't inherit from it because it's
        // not at all based on context value for filtering
        const lastPickedItem = getLastNode(wizardContext);

        if (!lastPickedItem) {
            // Something went wrong, no node was chosen
            throw new Error('No node was set after prompt step.');
        }

        if (this.isDirectPick(lastPickedItem)) {
            // The last picked node matches the expected ID
            // No need to continue prompting
            return undefined;
        } else {
            // Need to keep going because the last picked node is not a match
            return {
                hideStepCount: true,
                promptSteps: [
                    new FindByIdQuickPickStep(this.treeDataProvider, this.pickOptions)
                ],
            };
        }
    }

    protected override isIndirectPick(node: vscode.TreeItem): boolean {
        if (!node.collapsibleState) {
            // can't be an indirect pick if it doesn't have children
            return false;
        }

        if (node.id) {
            return this.pickOptions.id.startsWith(node.id);
        }

        return false;
    }

    protected override isDirectPick(node: vscode.TreeItem): boolean {
        return this.pickOptions.id === node.id;
    }
}
