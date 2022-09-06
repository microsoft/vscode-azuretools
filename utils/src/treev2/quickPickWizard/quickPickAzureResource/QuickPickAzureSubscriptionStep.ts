/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ResourceGroupsItem } from '../../../../hostapi.v2';
import { GenericQuickPickOptions, GenericQuickPickStep, SkipIfOneQuickPickOptions } from '../GenericQuickPickStep';
import { AzureResourceQuickPickWizardContext } from './AzureResourceQuickPickWizardContext';
import { SubscriptionItem } from './tempTypes';

export class QuickPickAzureSubscriptionStep extends GenericQuickPickStep<ResourceGroupsItem, AzureResourceQuickPickWizardContext, SkipIfOneQuickPickOptions> {
    public constructor(tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options?: GenericQuickPickOptions) {
        super(
            tdp,
            {
                ...options,
                skipIfOne: true, // Subscription is always skip-if-one
            }
        )
    }

    protected override async promptInternal(wizardContext: AzureResourceQuickPickWizardContext): Promise<SubscriptionItem> {
        const pickedSubscription = await super.promptInternal(wizardContext) as SubscriptionItem;

        // TODO
        wizardContext.subscription = pickedSubscription.subscription;

        return pickedSubscription;
    }

    protected isDirectPick(_node: SubscriptionItem): boolean {
        // Subscription is never a direct pick
        return false;
    }

    protected isIndirectPick(_node: SubscriptionItem): boolean {
        // All nodes at this level are always subscription nodes
        return true;
    }
}
