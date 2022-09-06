/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceGroupsItem } from "../../../../hostapi.v2";
import { QuickPickWizardContext } from "../QuickPickWizardContext";
import { ApplicationResource, ApplicationSubscription } from "./tempTypes";

export interface AzureResourceQuickPickWizardContext extends QuickPickWizardContext<ResourceGroupsItem> {
    subscription: ApplicationSubscription | undefined;
    resource: ApplicationResource | undefined;
    resourceGroup: string | undefined;
}
