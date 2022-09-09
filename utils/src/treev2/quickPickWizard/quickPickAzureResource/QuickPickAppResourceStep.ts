/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureResourceQuickPickWizardContext, ResourceGroupsItem } from '../../../../hostapi.v2';
import * as types from '../../../../index';
import { GenericQuickPickOptions, GenericQuickPickStep } from '../GenericQuickPickStep';
import { AppResourceItem } from './tempTypes';

interface AppResourceQuickPickOptions extends GenericQuickPickOptions {
    resourceType: types.AzExtResourceType;
    childItemFilter?: types.ContextValueFilter;
}

export class QuickPickAppResourceStep extends GenericQuickPickStep<ResourceGroupsItem, AzureResourceQuickPickWizardContext, AppResourceQuickPickOptions> {
    protected override async promptInternal(wizardContext: AzureResourceQuickPickWizardContext): Promise<AppResourceItem> {
        const pickedAppResource = await super.promptInternal(wizardContext) as AppResourceItem;

        // TODO
        wizardContext.resource = pickedAppResource.resource;
        wizardContext.resourceGroup = pickedAppResource.resource.resourceGroup;

        return pickedAppResource;
    }

    protected isDirectPick(node: AppResourceItem): boolean {
        // If childItemFilter is defined, this cannot be a direct pick
        if (this.pickOptions.childItemFilter) {
            return false;
        }

        return node.resource.azExtResourceType === this.pickOptions.resourceType;
    }

    protected isIndirectPick(node: AppResourceItem): boolean {
        // If childItemFilter is undefined, this cannot be an indirect pick
        if (!this.pickOptions.childItemFilter) {
            return false;
        }

        return node.resource.azExtResourceType === this.pickOptions.resourceType;
    }
}
