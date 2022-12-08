/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../../index';
import * as vscode from 'vscode';
import { RecursiveQuickPickStep } from '../RecursiveQuickPickStep';
import { getLastNode } from '../common/getLastNode';
import { NoResourceFoundError } from '../../../errors';
import { AzureWizardPromptStep } from '../../../wizard/AzureWizardPromptStep';
import { AzureWizard } from '../../../wizard/AzureWizard';
import { isWrapper } from '../../../registerCommandWithTreeNodeUnwrapping';
import { ResourceGroupsItem } from '../quickPickAzureResource/tempTypes';

export async function contextValueExperience<TPick extends unknown>(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, contextValueFilter: types.ContextValueFilter): Promise<TPick> {
    const promptSteps: AzureWizardPromptStep<types.QuickPickWizardContext>[] = [
        new RecursiveQuickPickStep(tdp, {
            contextValueFilter: contextValueFilter,
            skipIfOne: false,
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
