/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureResourceQuickPickWizardContext, AzureSubscriptionQuickPickOptions, SkipIfOneQuickPickOptions } from '../../../index';
import { GenericQuickPickStepWithCommands } from '../GenericQuickPickStepWithCommands';
import { PickFilter } from '../PickFilter';
import { ResourceGroupsItem, SubscriptionItem } from './tempTypes';

export class QuickPickAzureSubscriptionStep extends GenericQuickPickStepWithCommands<AzureResourceQuickPickWizardContext, SkipIfOneQuickPickOptions> {
    protected readonly pickFilter: PickFilter;

    public constructor(tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options?: AzureSubscriptionQuickPickOptions) {
        super(tdp, {
            ...options,
            skipIfOne: true, // Subscription is always skip-if-one
        }, {
            placeHolder: vscode.l10n.t('Select subscription'),
            noPicksMessage: vscode.l10n.t('No subscriptions found'),
        });

        this.pickFilter = new AzureSubscriptionPickFilter(options?.selectBySubscriptionId);
    }

    protected override async promptInternal(wizardContext: AzureResourceQuickPickWizardContext): Promise<SubscriptionItem> {
        const pickedSubscription = await super.promptInternal(wizardContext) as SubscriptionItem;

        // TODO
        wizardContext.subscription = pickedSubscription.subscription;

        return pickedSubscription;
    }
}

class AzureSubscriptionPickFilter implements PickFilter {
    private readonly subscriptionId?: string;

    constructor(subscriptionId?: string) {
        // Always ensure we are storing the subscriptionId, not the full subscription path
        this.subscriptionId = subscriptionId?.split('/').pop();
    }

    isFinalPick(_treeItem: vscode.TreeItem): boolean {
        // Subscription is never a direct pick
        return false;
    }

    isAncestorPick(_treeItem: vscode.TreeItem, element: SubscriptionItem): boolean {
        // All nodes at this level are always subscription nodes
        return this.subscriptionId ? element.subscription.subscriptionId === this.subscriptionId : true;
    }
}
