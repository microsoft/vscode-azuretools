/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../../index';
import * as vscode from 'vscode';
import { ContextValueFilter, ContextValueFilterableTreeNode } from '../ContextValueQuickPickStep';
import { RecursiveQuickPickStep } from '../RecursiveQuickPickStep';
import { getLastNode, QuickPickWizardContext } from '../QuickPickWizardContext';
import { NoResourceFoundError } from '../../../errors';

export async function contextValueExperience<TPick extends ContextValueFilterableTreeNode>(context: types.IActionContext, tdp: vscode.TreeDataProvider<TPick>, contextValueFilter: ContextValueFilter): Promise<TPick> {
    const promptSteps: types.AzureWizardPromptStep<QuickPickWizardContext<TPick>>[] = [
        new RecursiveQuickPickStep(tdp, {
            contextValueFilter: contextValueFilter,
            skipIfOne: false,
        }),
    ];

    // Fill in the `pickedNodes` property
    const wizardContext = context as QuickPickWizardContext<TPick>;
    wizardContext.pickedNodes = [];

    const wizard = new types.AzureWizard(context, {
        hideStepCount: true,
        promptSteps: promptSteps,
    });

    await wizard.prompt();

    const lastPickedItem = getLastNode(wizardContext);

    if (!lastPickedItem) {
        throw new NoResourceFoundError(wizardContext);
    } else {
        return lastPickedItem;
    }
}
