/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureResourceQuickPickWizardContext, AzureSubscriptionQuickPickOptions, IAzureQuickPickItem, SkipIfOneQuickPickOptions } from '../../../index';
import { GenericQuickPickStepWithCommands } from '../GenericQuickPickStepWithCommands';
import { PickFilter } from '../PickFilter';
import { ResourceGroupsItem, SubscriptionItem } from './tempTypes';

export class QuickPickAzureSubscriptionStep extends GenericQuickPickStepWithCommands<AzureResourceQuickPickWizardContext, SkipIfOneQuickPickOptions> {
    protected subscriptionId?: string;

    public constructor(tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options?: AzureSubscriptionQuickPickOptions) {
        super(tdp, {
            ...options,
            skipIfOne: true, // Subscription is always skip-if-one
        }, {
            placeHolder: vscode.l10n.t('Select subscription'),
            noPicksMessage: vscode.l10n.t('No subscriptions found'),
        });

        this.subscriptionId = options?.selectSubscriptionId;
    }

    protected readonly pickFilter = new AzureSubscriptionPickFilter();

    protected override async promptInternal(wizardContext: AzureResourceQuickPickWizardContext): Promise<SubscriptionItem> {
        const pickedSubscription = await super.promptInternal(wizardContext) as SubscriptionItem;

        // TODO
        wizardContext.subscription = pickedSubscription.subscription;

        return pickedSubscription;
    }

    protected override getPickWithoutPrompt(picks: IAzureQuickPickItem<SubscriptionItem>[]): IAzureQuickPickItem<SubscriptionItem> | undefined {
        if (!this.subscriptionId) {
            return undefined;
        }

        return picks.find(pick => pick.data.subscription.subscriptionId === this.subscriptionId);
    }
}

class AzureSubscriptionPickFilter implements PickFilter {
    isFinalPick(_node: vscode.TreeItem): boolean {
        // Subscription is never a direct pick
        return false;
    }

    isAncestorPick(_node: vscode.TreeItem): boolean {
        // All nodes at this level are always subscription nodes
        return true;
    }
}
