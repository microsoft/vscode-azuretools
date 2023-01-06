import * as types from '../../../../index';
import * as vscode from 'vscode';
import { ResourceGroupsItem } from '../../quickPickAzureResource/tempTypes';
import { azureResourceExperience } from '../azureResourceExperience';
import { subscriptionExperience } from '../subscriptionExperience';
import { isAzExtTreeItem } from '../../../tree/isAzExtTreeItem';
import { createSubscriptionContext } from '../../../utils/credentialUtils';
import { ISubscriptionContext } from '@microsoft/vscode-azext-dev';
import { AzExtTreeItem } from '../../../tree/AzExtTreeItem';
import { CompatibilityRecursiveQuickPickStep } from '../../contextValue/compatibility/CompatibilityRecursiveQuickPickStep';
import { AzureWizardPromptStep } from '../../../wizard/AzureWizardPromptStep';
import { AzureWizard } from '../../../wizard/AzureWizard';
import { getLastNode } from '../../getLastNode';
import { NoResourceFoundError } from '../../../errors';
import { isWrapper } from '../../../registerCommandWithTreeNodeUnwrapping';

export namespace PickTreeItemWithCompatibility {
    /**
     * Provides compatibility for the legacy `pickAppResource` Resource Groups API
     */
    export async function resource<TPick extends types.AzExtTreeItem>(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options: types.CompatibilityPickResourceExperienceOptions): Promise<TPick> {
        const { resourceTypes, childItemFilter } = options;
        return azureResourceExperience({ ...context, v1Compatibility: true }, tdp, resourceTypes ? Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes] : undefined, childItemFilter);
    }

    /**
     * Returns `ISubscriptionContext` instead of `ApplicationSubscription` for compatibility.
     */
    export async function subscription(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>): Promise<ISubscriptionContext> {
        const applicationSubscription = await subscriptionExperience(context, tdp);

        if (isAzExtTreeItem(applicationSubscription)) {
            return applicationSubscription.subscription;
        }

        return createSubscriptionContext(applicationSubscription);
    }

    /**
     * Helper to provide compatibility for `AzExtParentTreeItem.showTreeItemPicker`.
     */
    export async function showTreeItemPicker<TPick extends types.AzExtTreeItem>(context: types.ITreeItemPickerContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, expectedContextValues: string | RegExp | (string | RegExp)[], startingTreeItem?: AzExtTreeItem): Promise<TPick> {
        const promptSteps: AzureWizardPromptStep<types.QuickPickWizardContext & types.ITreeItemPickerContext>[] = [
            new CompatibilityRecursiveQuickPickStep(tdp, {
                contextValueFilter: {
                    include: expectedContextValues,
                },
                skipIfOne: false,
            }),
        ];

        const wizardContext: types.QuickPickWizardContext & types.ITreeItemPickerContext = {
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
