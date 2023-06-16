/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureResourceQuickPickWizardContext, GenericQuickPickOptions, SkipIfOneQuickPickOptions } from '../../../index';
import { GenericQuickPickStepWithCommands } from '../GenericQuickPickStepWithCommands';
import { PickFilter } from '../PickFilter';
import { ResourceGroupsItem, SubscriptionItem } from './tempTypes';

export class QuickPickAzureSubscriptionStep extends GenericQuickPickStepWithCommands<AzureResourceQuickPickWizardContext, SkipIfOneQuickPickOptions> {
    public constructor(tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options?: GenericQuickPickOptions) {
        super(tdp, {
            ...options,
            skipIfOne: true, // Subscription is always skip-if-one
        }, {
            placeHolder: vscode.l10n.t('Select subscription'),
            noPicksMessage: vscode.l10n.t('No subscriptions found'),
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
