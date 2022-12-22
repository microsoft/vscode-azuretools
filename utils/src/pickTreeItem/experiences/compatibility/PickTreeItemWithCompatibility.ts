import * as types from '../../../../index';
import * as vscode from 'vscode';
import { ResourceGroupsItem } from '../../quickPickAzureResource/tempTypes';
import { azureResourceExperience } from '../azureResourceExperience';
import { subscriptionExperience } from '../subscriptionExperience';
import { isAzExtTreeItem } from '../../../tree/isAzExtTreeItem';
import { createSubscriptionContext } from '../../../utils/credentialUtils';
import { ISubscriptionContext } from '@microsoft/vscode-azext-dev';

export namespace PickTreeItemWithCompatibility {
    /**
     * Provides compatibility for the legacy `pickAppResource` Resource Groups API
     */
    export async function resource<TPick extends types.AzExtTreeItem>(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options: types.CompatibilityPickResourceExperienceOptions): Promise<TPick> {
        const { resourceTypes, childItemFilter } = options;
        return azureResourceExperience(context, tdp, resourceTypes ? Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes] : undefined, childItemFilter);
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
}
