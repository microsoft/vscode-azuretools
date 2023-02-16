/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { PickFilter } from '../PickFilter';
import { GenericQuickPickStep } from '../GenericQuickPickStep';
import { ResourceGroupsItem, SubscriptionItem } from './tempTypes';
import { localize } from '../../localize';
import { AzureResourceQuickPickWizardContext, GenericQuickPickOptions, SkipIfOneQuickPickOptions } from '../../../index';

export class QuickPickAzureSubscriptionStep extends GenericQuickPickStep<AzureResourceQuickPickWizardContext, SkipIfOneQuickPickOptions> {
    public constructor(tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options?: GenericQuickPickOptions) {
        super(tdp, {
            ...options,
            skipIfOne: true, // Subscription is always skip-if-one
        }, {
            placeHolder: localize('selectSubscription', 'Select subscription'),
            noPicksMessage: localize('noSubscriptions', 'No subscriptions found'),
        });
    }

    protected readonly pickFilter = new AzureSubscriptionPickFilter();

    protected override async promptInternal(wizardContext: AzureResourceQuickPickWizardContext): Promise<SubscriptionItem> {
        const pickedSubscription = await super.promptInternal(wizardContext) as SubscriptionItem;

        // TODO
        wizardContext.subscription = pickedSubscription.subscription;

        return pickedSubscription;
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
