/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationResource, ApplicationSubscription, ResourceGroupsItem } from "../../../../hostapi.v2";
import { QuickPickWizardContext } from "../QuickPickWizardContext";

export interface AzureResourceQuickPickWizardContext extends QuickPickWizardContext<ResourceGroupsItem> {
    subscription?: ApplicationSubscription;
    resource?: ApplicationResource;
    resourceGroup?: string;
}
