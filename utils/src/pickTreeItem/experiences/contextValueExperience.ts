/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as vscode from 'vscode';
import { RecursiveQuickPickStep } from '../contextValue/RecursiveQuickPickStep';
import { AzureWizardPromptStep } from '../../wizard/AzureWizardPromptStep';
import { ResourceGroupsItem } from '../quickPickAzureResource/tempTypes';
import { runQuickPickWizard } from '../runQuickPickWizard';

export async function contextValueExperience<TPick>(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, contextValueFilter: types.ContextValueFilter): Promise<TPick> {
    const promptSteps: AzureWizardPromptStep<types.QuickPickWizardContext>[] = [
        new RecursiveQuickPickStep(tdp, {
            contextValueFilter: contextValueFilter,
            skipIfOne: false,
        }),
    ];

    return await runQuickPickWizard(context, {
        hideStepCount: true,
        promptSteps: promptSteps,
    });
}
