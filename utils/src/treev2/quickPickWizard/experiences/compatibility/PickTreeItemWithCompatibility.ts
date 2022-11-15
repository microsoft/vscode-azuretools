import * as types from '../../../../../index';
import * as vscode from 'vscode';
import { ResourceGroupsItem } from '../../quickPickAzureResource/tempTypes';
import { appResourceExperience } from '../appResourceExperience';
import { subscriptionExperience } from '../subscriptionExperience';
import { isAzExtTreeItem } from '../../../../tree/isAzExtParentTreeItem';
import { createSubscriptionContext } from '../../../../utils/credentialUtils';
import { ISubscriptionContext } from '@microsoft/vscode-azext-dev';

export namespace PickTreeItemWithCompatibility {
    /**
     * Provides compatibility for the legacy `pickAppResource` Resource Groups API
     */
    export async function resource<TPick extends types.AzExtTreeItem>(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options: types.CompatibilityPickResourceExperienceOptions): Promise<TPick> {
        const { resourceTypes, childItemFilter } = options;
        return appResourceExperience(context, tdp, resourceTypes ? Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes] : undefined, childItemFilter);
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
