/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from '../../../../../index';
import * as vscode from 'vscode';
import { ISubscriptionContext } from '@microsoft/vscode-azext-dev';
import { subscriptionExperience } from '../subscriptionExperience';
import { createSubscriptionContext } from '../../../../utils/credentialUtils';
import { ResourceGroupsItem } from '../../quickPickAzureResource/tempTypes';
import { isAzExtTreeItem } from '../../../../tree/isAzExtParentTreeItem';

/**
 * Returns `ISubscriptionContext` instead of `ApplicationSubscription` for compatibility.
 */
export async function compatibilitySubscriptionExperience(context: types.IActionContext, tdp: vscode.TreeDataProvider<ResourceGroupsItem>): Promise<ISubscriptionContext> {
    const applicationSubscription = await subscriptionExperience(context, tdp);

    if (isAzExtTreeItem(applicationSubscription)) {
        return applicationSubscription.subscription;
    }

    return createSubscriptionContext(applicationSubscription);
}
