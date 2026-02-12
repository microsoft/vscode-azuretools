/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IActionContext } from '../../../types/actionContext';
import type { QuickPickWizardContext, CompatibilityPickResourceExperienceOptions } from '../../../types/pickExperience';
import type { ISubscriptionContext } from '../../../types/subscription';
import type { ITreeItemPickerContext } from '../../../types/treeItem';
import * as vscode from 'vscode';
import { ResourceGroupsItem } from '../../quickPickAzureResource/tempTypes';
import { azureResourceExperience, InternalAzureResourceExperienceOptions } from '../azureResourceExperience';
import { subscriptionExperience } from '../subscriptionExperience';
import { isAzExtTreeItem } from '../../../tree/isAzExtTreeItem';
import { createSubscriptionContext } from '../../../utils/credentialUtils';
import { AzExtTreeItem } from '../../../tree/AzExtTreeItem';
import { CompatibilityRecursiveQuickPickStep } from '../../contextValue/compatibility/CompatibilityRecursiveQuickPickStep';
import { AzureWizardPromptStep } from '../../../wizard/AzureWizardPromptStep';
import { AzureWizard } from '../../../wizard/AzureWizard';
import { getLastNode } from '../../getLastNode';
import { NoResourceFoundError } from '../../../errors';
import { isWrapper } from '@microsoft/vscode-azureresources-api';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PickTreeItemWithCompatibility {
    /**
     * Provides compatibility for the legacy `pickAppResource` Resource Groups API
     */
    export async function resource<TPick extends AzExtTreeItem>(context: IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options: CompatibilityPickResourceExperienceOptions): Promise<TPick> {
        const { resourceTypes, childItemFilter } = options;
        (context as InternalAzureResourceExperienceOptions).v1Compatibility = true;
        return azureResourceExperience(context, tdp, resourceTypes ? Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes] : undefined, childItemFilter);
    }

    /**
     * Returns `ISubscriptionContext` instead of `ApplicationSubscription` for compatibility.
     */
    export async function subscription(context: IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>): Promise<ISubscriptionContext> {
        const applicationSubscription = await subscriptionExperience(context, tdp);

        if (isAzExtTreeItem(applicationSubscription)) {
            return applicationSubscription.subscription;
        }

        return createSubscriptionContext(applicationSubscription);
    }

    /**
     * Helper to provide compatibility for `AzExtParentTreeItem.showTreeItemPicker`.
     */
    export async function showTreeItemPicker<TPick extends AzExtTreeItem>(context: ITreeItemPickerContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, expectedContextValues: string | RegExp | (string | RegExp)[], startingTreeItem?: AzExtTreeItem): Promise<TPick> {
        const promptSteps: AzureWizardPromptStep<QuickPickWizardContext & ITreeItemPickerContext>[] = [
            new CompatibilityRecursiveQuickPickStep(tdp, {
                contextValueFilter: {
                    include: expectedContextValues,
                },
                skipIfOne: false,
            }),
        ];

        const wizardContext: QuickPickWizardContext & ITreeItemPickerContext = {
            ...context,
            pickedNodes: startingTreeItem ? [startingTreeItem] : [],
        };

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
}
