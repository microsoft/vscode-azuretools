/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem } from 'vscode';
import { AzureResourceQuickPickWizardContext, ResourceGroupsItem } from '../../../../hostapi.v2';
import * as types from '../../../../index';
import { parseContextValue } from '../../../utils/contextUtils';
import { GenericQuickPickOptions, GenericQuickPickStep } from '../GenericQuickPickStep';
import { AppResourceItem } from './tempTypes';

interface AppResourceQuickPickOptions extends GenericQuickPickOptions {
    resourceTypes?: types.AzExtResourceType[];
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

    protected isDirectPick(node: TreeItem): boolean {
        // If childItemFilter is defined, this cannot be a direct pick
        if (this.pickOptions.childItemFilter) {
            return false;
        }

        const contextValues = parseContextValue(node.contextValue);

        if (!contextValues.includes('azureResource')) {
            return false;
        }

        return !this.pickOptions.resourceTypes || this.pickOptions.resourceTypes.some((type) => contextValues.includes(type));
    }

    protected isIndirectPick(node: TreeItem): boolean {
        // If childItemFilter is undefined, this cannot be an indirect pick
        if (!this.pickOptions.childItemFilter) {
            return false;
        }

        const contextValues = parseContextValue(node.contextValue);

        if (!contextValues.includes('azureResource')) {
            return false;
        }

        return !this.pickOptions.resourceTypes || this.pickOptions.resourceTypes.some((type) => contextValues.includes(type));
    }
}
