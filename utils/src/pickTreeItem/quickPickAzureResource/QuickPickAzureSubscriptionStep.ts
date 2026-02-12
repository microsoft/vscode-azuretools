/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AzureResourceQuickPickWizardContext, AzureSubscriptionQuickPickOptions, SkipIfOneQuickPickOptions } from '../../types/pickExperience';
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

        try {
            // it's possible that if subscription is not set on AzExtTreeItems, an error is thrown
            // see https://github.com/microsoft/vscode-azuretools/blob/cc1feb3a819dd503eb59ebcc1a70051d4e9a3432/utils/src/tree/AzExtTreeItem.ts#L154
            wizardContext.telemetry.properties.subscriptionId = pickedSubscription.subscription.subscriptionId;
        } catch {
            // we don't want to block execution just because we can't set the telemetry property
            // see https://github.com/microsoft/vscode-azureresourcegroups/issues/1081
        }

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
