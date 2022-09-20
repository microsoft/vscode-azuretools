/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { QuickPickAzureSubscriptionStep } from '../quickPickAzureResource/QuickPickAzureSubscriptionStep';
import { QuickPickGroupStep } from '../quickPickAzureResource/QuickPickGroupStep';
import { QuickPickAppResourceStep } from '../quickPickAzureResource/QuickPickAppResourceStep';
import { getLastNode } from '../QuickPickWizardContext';
import { NoResourceFoundError } from '../../../errors';
import * as types from '../../../../index';
import { AzureWizardPromptStep } from '../../../wizard/AzureWizardPromptStep';
import { AzureWizard } from '../../../wizard/AzureWizard';
import { AzureResourceQuickPickWizardContext } from '../../../../hostapi.v2';
import { CompatibilityRecursiveQuickPickStep } from '../compatibility/CompatibilityRecursiveQuickPickStep';
import { isWrapper } from '../../../registerCommandWithTreeNodeUnwrapping';

/**
 * Provides compatibility for the legacy `pickAppResource` Resource Groups API
 */
export async function compatibilityPickAppResourceExperience<TPick extends types.AzExtTreeItem>(context: types.IActionContext, tdp: vscode.TreeDataProvider<unknown>, options: types.CompatibilityPickResourceExperienceOptions): Promise<TPick> {
    const { resourceTypes, childItemFilter } = options;

    const promptSteps: AzureWizardPromptStep<AzureResourceQuickPickWizardContext>[] = [
        new QuickPickAzureSubscriptionStep(tdp),
        new QuickPickGroupStep(tdp, {
            groupType: resourceTypes ? Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes] : undefined,
        }),
        new QuickPickAppResourceStep(tdp, {
            resourceTypes: resourceTypes ? Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes] : undefined,
            skipIfOne: false,
            childItemFilter,
        }),
    ];

    if (childItemFilter) {
        promptSteps.push(new CompatibilityRecursiveQuickPickStep<AzureResourceQuickPickWizardContext>(tdp, {
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
        return isWrapper(lastPickedItem) ? lastPickedItem.unwrap<TPick>() : lastPickedItem as unknown as TPick;
    }
}
