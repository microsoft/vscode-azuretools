/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { AzExtResourceType, AzureResource, AzureSubscription } from '@microsoft/vscode-azureresources-api';
import type { IActionContext } from './actionContext';

export interface PickExperienceContext extends IActionContext {
    /**
     * If true, the result will not be unwrapped. Intented for use internally by the Azure Resources extension.
     */
    dontUnwrap?: boolean;
}

export interface QuickPickWizardContext extends IActionContext {
    pickedNodes: unknown[];
}

/**
 * Describes filtering based on context value. Items that pass the filter will
 * match at least one of the `include` filters, but none of the `exclude` filters.
 */
export interface ContextValueFilter {
    /**
     * This filter will include items that match *any* of the values in the array.
     * When a string is used, exact value comparison is done.
     */
    include: string | RegExp | (string | RegExp)[];

    /**
     * This filter will exclude items that match *any* of the values in the array.
     * When a string is used, exact value comparison is done.
     */
    exclude?: string | RegExp | (string | RegExp)[];
}

export interface PickSubscriptionWizardContext extends QuickPickWizardContext {
    subscription?: AzureSubscription;
}

export interface AzureResourceQuickPickWizardContext extends QuickPickWizardContext, PickSubscriptionWizardContext {
    resource?: AzureResource;
    resourceGroup?: string;
    resourceId?: string;
    subscriptionId?: string;
}

export interface GenericQuickPickOptions {
    skipIfOne?: boolean;
}

export interface SkipIfOneQuickPickOptions extends GenericQuickPickOptions {
    skipIfOne?: true;
}

export interface AzureSubscriptionQuickPickOptions extends GenericQuickPickOptions {
    selectBySubscriptionId?: string;
}

export interface GroupQuickPickOptions extends SkipIfOneQuickPickOptions {
    groupType?: AzExtResourceType[];
    skipIfOne?: true;
}

export interface AzureResourceQuickPickOptions extends GenericQuickPickOptions {
    resourceTypes?: AzExtResourceType[];
    childItemFilter?: ContextValueFilter;
}

export interface ContextValueFilterQuickPickOptions extends GenericQuickPickOptions {
    contextValueFilter: ContextValueFilter;
}

export interface CompatibilityPickResourceExperienceOptions {
    resourceTypes?: AzExtResourceType | AzExtResourceType[];
    childItemFilter?: ContextValueFilter;
}
