/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as vscode from 'vscode';
import { AzureWizard } from '../../wizard/AzureWizard';
import { QuickPickAzureSubscriptionStep } from '../quickPickAzureResource/QuickPickAzureSubscriptionStep';
import { PickSubscriptionWizardContext } from '../../../index';
import { ResourceGroupsItem } from '../quickPickAzureResource/tempTypes';
import { NoResourceFoundError } from '../../errors';
import type { AzureSubscription } from '@microsoft/vscode-azureresources-api';

export async function subscriptionExperience(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>): Promise<AzureSubscription> {

    const wizardContext = { ...context } as PickSubscriptionWizardContext;
    wizardContext.pickedNodes = [];

    const wizard = new AzureWizard(wizardContext, {
        hideStepCount: true,
        promptSteps: [new QuickPickAzureSubscriptionStep(tdp)],
        showLoadingPrompt: true,
    });

    await wizard.prompt();

    if (!wizardContext.subscription) {
        throw new NoResourceFoundError(wizardContext);
    } else {
        return wizardContext.subscription;
    }
}
