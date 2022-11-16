/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../../index';
import * as vscode from 'vscode';
import { getLastNode } from '../QuickPickWizardContext';
import { NoResourceFoundError } from '../../../errors';
import { FindByIdQuickPickStep } from '../FindByIdQuickPickStep';
import { isWrapper } from '../../../registerCommandWithTreeNodeUnwrapping';
import { AzureWizard } from '../../../wizard/AzureWizard';
import { ResourceGroupsItem } from '../quickPickAzureResource/tempTypes';

export async function findByIdExperience<TPick extends types.FindableByIdTreeNode>(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, id: string): Promise<TPick> {
    const promptSteps: types.AzureWizardPromptStep<types.QuickPickWizardContext>[] = [
        new FindByIdQuickPickStep(tdp, {
            id: id,
        }),
    ];

    // Fill in the `pickedNodes` property
    const wizardContext = { ...context } as types.QuickPickWizardContext;
    wizardContext.pickedNodes = [];

    const wizard = new AzureWizard(wizardContext, {
        hideStepCount: true,
        promptSteps: promptSteps,
    });

    await wizard.prompt();

    const lastPickedItem = getLastNode(wizardContext);

    if (!lastPickedItem) {
        throw new NoResourceFoundError(wizardContext);
    } else {
        return isWrapper(lastPickedItem) ? lastPickedItem.unwrap<TPick>() : lastPickedItem as unknown as TPick;
    }
}
