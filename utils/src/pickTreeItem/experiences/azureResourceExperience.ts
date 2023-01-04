/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as types from '../../../index';
import { QuickPickAzureSubscriptionStep } from '../quickPickAzureResource/QuickPickAzureSubscriptionStep';
import { QuickPickGroupStep } from '../quickPickAzureResource/QuickPickGroupStep';
import { QuickPickAzureResourceStep } from '../quickPickAzureResource/QuickPickAzureResourceStep';
import { RecursiveQuickPickStep } from '../contextValue/RecursiveQuickPickStep';
import { getLastNode } from '../getLastNode';
import { NoResourceFoundError } from '../../errors';
import { AzureWizardPromptStep } from '../../wizard/AzureWizardPromptStep';
import { AzExtResourceType } from '../../AzExtResourceType';
import { AzureWizard } from '../../wizard/AzureWizard';
import { AzureResourceQuickPickWizardContext } from '../../../hostapi.v2';
import { ResourceGroupsItem } from '../quickPickAzureResource/tempTypes';
import { isWrapper } from '../../registerCommandWithTreeNodeUnwrapping';
import { CompatibilityRecursiveQuickPickStep } from '../contextValue/compatibility/CompatibilityRecursiveQuickPickStep';

export interface InternalAzureResourceExperienceOptions extends types.PickExperienceContext {
    v1Compatibility?: boolean;
}

export async function azureResourceExperience<TPick>(context: InternalAzureResourceExperienceOptions, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, resourceTypes?: AzExtResourceType | AzExtResourceType[], childItemFilter?: types.ContextValueFilter): Promise<TPick> {
    const promptSteps: AzureWizardPromptStep<AzureResourceQuickPickWizardContext>[] = [
        new QuickPickAzureSubscriptionStep(tdp),
        new QuickPickGroupStep(tdp, {
            groupType: resourceTypes ?
                (Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes]) :
                undefined,
        }),
        new QuickPickAzureResourceStep(tdp, {
            resourceTypes: resourceTypes ?
                (Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes]) :
                undefined,
            skipIfOne: false,
        }),
    ];

    if (childItemFilter) {
        promptSteps.push(
            context.v1Compatibility ?
                new CompatibilityRecursiveQuickPickStep(tdp, {
                    contextValueFilter: childItemFilter,
                    skipIfOne: false,
                }) :
                new RecursiveQuickPickStep<AzureResourceQuickPickWizardContext>(tdp, {
                    contextValueFilter: childItemFilter,
                    skipIfOne: false,
                })
        );
    }

    // Fill in the `pickedNodes` property
    const wizardContext = { ...context } as AzureResourceQuickPickWizardContext;
    wizardContext.pickedNodes = [];

    const wizard = new AzureWizard(wizardContext, {
        hideStepCount: true,
        promptSteps: promptSteps,
        showLoadingPrompt: true,
    });

    await wizard.prompt();

    const lastPickedItem = getLastNode(wizardContext);
    if (!lastPickedItem) {
        throw new NoResourceFoundError(wizardContext);
    } else {
        return (!context.dontUnwrap && isWrapper(lastPickedItem)) ? lastPickedItem.unwrap() : lastPickedItem as unknown as TPick;
    }
}
