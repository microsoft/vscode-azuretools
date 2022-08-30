/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../../index';
import * as vscode from 'vscode';
import { ContextValueFilter } from '../ContextValueQuickPickStep';
import { QuickPickAzureSubscriptionStep } from '../quickPickAzureResource/QuickPickAzureSubscriptionStep';
import { QuickPickGroupStep } from '../quickPickAzureResource/QuickPickGroupStep';
import { QuickPickAppResourceStep } from '../quickPickAzureResource/QuickPickAppResourceStep';
import { AzureResourceQuickPickWizardContext } from '../quickPickAzureResource/AzureResourceQuickPickWizardContext';
import { RecursiveQuickPickStep } from '../RecursiveQuickPickStep';
import { Box, ResourceGroupsItem } from '../quickPickAzureResource/tempTypes';
import { getLastNode } from '../QuickPickWizardContext';
import { NoResourceFoundError } from '../../../errors';

export async function appResourceExperience<TPick>(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, resourceType: types.AzExtResourceType, childItemFilter?: ContextValueFilter): Promise<TPick> {
    const promptSteps: types.AzureWizardPromptStep<AzureResourceQuickPickWizardContext>[] = [
        new QuickPickAzureSubscriptionStep(tdp),
        new QuickPickGroupStep(tdp, {
            groupType: resourceType,
        }),
        new QuickPickAppResourceStep(tdp, {
            resourceType: resourceType,
            skipIfOne: false,
        }),
    ];

    if (childItemFilter) {
        promptSteps.push(new RecursiveQuickPickStep<ResourceGroupsItem, AzureResourceQuickPickWizardContext>(tdp, {
            contextValueFilter: childItemFilter,
            skipIfOne: false,
        }));
    }

    // Fill in the `pickedNodes` property
    const wizardContext = context as AzureResourceQuickPickWizardContext;
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
        // Treat lastPickedItem as a box containing the desired end object
        // TODO
        const pickedAsBox = lastPickedItem as unknown as Box<TPick>;
        return pickedAsBox.unwrap();
    }
}
