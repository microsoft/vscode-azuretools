/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import * as vscode from 'vscode';
import { getLastNode } from './getLastNode';
import { GenericQuickPickStep } from './GenericQuickPickStep';

export abstract class GenericQuickPickStepWithCommands<TContext extends types.QuickPickWizardContext, TOptions extends types.GenericQuickPickOptions> extends GenericQuickPickStep<TContext, TOptions> {

    // provide support for picking command tree items, and running the command within the wizard
    public async getSubWizard(wizardContext: TContext): Promise<types.IWizardOptions<TContext> | undefined> {
        const lastPick = getLastNode(wizardContext);
        const treeItem = await this.treeDataProvider.getTreeItem(lastPick);
        if (treeItem.command) {
            await vscode.commands.executeCommand(treeItem.command.command, ...(treeItem.command.arguments as unknown[] ?? []));
            wizardContext.pickedNodes.pop();
            return {
                // rerun current step after command is executed
                promptSteps: [this],
            }
        }
        return undefined;
    }
}
