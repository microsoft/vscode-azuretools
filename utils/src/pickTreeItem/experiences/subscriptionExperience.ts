/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { AzureSubscription } from '@microsoft/vscode-azureresources-api';
import * as vscode from 'vscode';
import * as types from '../../../index';
import { PickSubscriptionWizardContext } from '../../../index';
import { NoResourceFoundError } from '../../errors';
import { AzureWizard } from '../../wizard/AzureWizard';
import { QuickPickAzureSubscriptionStep } from '../quickPickAzureResource/QuickPickAzureSubscriptionStep';
import { ResourceGroupsItem } from '../quickPickAzureResource/tempTypes';

export async function subscriptionExperience(
    context: types.IActionContext,
    tdp: vscode.TreeDataProvider<ResourceGroupsItem>,
    options?: { selectBySubscriptionId?: string, showLoadingPrompt?: boolean }
): Promise<AzureSubscription> {

    const wizardContext = { ...context } as PickSubscriptionWizardContext;
    wizardContext.pickedNodes = [];

    const wizard = new AzureWizard(wizardContext, {
        hideStepCount: true,
        promptSteps: [new QuickPickAzureSubscriptionStep(tdp, { selectBySubscriptionId: options?.selectBySubscriptionId })],
        showLoadingPrompt: options?.showLoadingPrompt ?? true,
    });

    await wizard.prompt();

    if (!wizardContext.subscription) {
        throw new NoResourceFoundError(wizardContext);
    } else {
        return wizardContext.subscription;
    }
}
