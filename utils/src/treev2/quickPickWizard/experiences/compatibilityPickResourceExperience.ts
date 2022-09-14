/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { QuickPickAzureSubscriptionStep } from '../quickPickAzureResource/QuickPickAzureSubscriptionStep';
import { QuickPickGroupStep } from '../quickPickAzureResource/QuickPickGroupStep';
import { QuickPickAppResourceStep } from '../quickPickAzureResource/QuickPickAppResourceStep';
import { AzureResourceQuickPickWizardContext } from '../quickPickAzureResource/AzureResourceQuickPickWizardContext';
import { getLastNode } from '../QuickPickWizardContext';
import { NoResourceFoundError } from '../../../errors';
import { IActionContext } from '../../../../index';
import { AzureWizardPromptStep } from '../../../wizard/AzureWizardPromptStep';
import { AzExtResourceType } from '../../../AzExtResourceType';
import { AzureWizard } from '../../../wizard/AzureWizard';
import { ContextValueFilter, ResourceGroupsItem } from '../../../../hostapi.v2';
import { isBox } from '../../../registerCommandWithTreeNodeUnboxing';
import { CompatibilityRecursiveQuickPickStep } from '../compatibility/CompatibilityRecursiveQuickPickStep';

export async function compatibilityPickResourceExperience<TPick>(context: IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, resourceTypes?: AzExtResourceType | AzExtResourceType[], childItemFilter?: ContextValueFilter): Promise<TPick> {
    const promptSteps: AzureWizardPromptStep<AzureResourceQuickPickWizardContext>[] = [
        new QuickPickAzureSubscriptionStep(tdp),
        new QuickPickGroupStep(tdp, {
            groupType: resourceTypes ? Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes] : undefined,
        }),
        new QuickPickAppResourceStep(tdp, {
            resourceTypes: resourceTypes ? Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes] : undefined,
            skipIfOne: false,
        }),
    ];

    if (childItemFilter) {
        promptSteps.push(new CompatibilityRecursiveQuickPickStep<ResourceGroupsItem, AzureResourceQuickPickWizardContext>(tdp, {
            contextValueFilter: childItemFilter,
            skipIfOne: false,
        }));
    }

    // Fill in the `pickedNodes` property
    const wizardContext = context as AzureResourceQuickPickWizardContext;
    wizardContext.pickedNodes = [];

    const wizard = new AzureWizard(context, {
        hideStepCount: true,
        promptSteps: promptSteps,
        showLoadingPrompt: true,
    });

    await wizard.prompt();

    const lastPickedItem = getLastNode(wizardContext);

    if (!lastPickedItem) {
        throw new NoResourceFoundError(wizardContext);
    } else {
        return isBox(lastPickedItem) ? lastPickedItem.unwrap<TPick>() : lastPickedItem as unknown as TPick;
    }
}
