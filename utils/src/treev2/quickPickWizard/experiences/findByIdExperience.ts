/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../../index';
import * as vscode from 'vscode';
import { getLastNode } from '../QuickPickWizardContext';
import { NoResourceFoundError } from '../../../errors';
import { FindByIdQuickPickStep } from '../FindByIdQuickPickStep';

export async function findByIdExperience<TPick extends types.FindableByIdTreeNode>(context: types.IActionContext, tdp: vscode.TreeDataProvider<TPick>, id: string): Promise<TPick> {
    const promptSteps: types.AzureWizardPromptStep<types.QuickPickWizardContext<TPick>>[] = [
        new FindByIdQuickPickStep(tdp, {
            id: id,
        }),
    ];

    // Fill in the `pickedNodes` property
    const wizardContext = context as types.QuickPickWizardContext<TPick>;
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
