/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem } from 'vscode';
import { AzureResourceQuickPickWizardContext } from '../../../hostapi.v2';
import * as types from '../../../index';
import { parseContextValue } from '../../utils/contextUtils';
import { PickFilter } from '../PickFilter';
import { GenericQuickPickOptions, GenericQuickPickStep } from '../GenericQuickPickStep';
import { AzureResourceItem } from './tempTypes';

interface AppResourceQuickPickOptions extends GenericQuickPickOptions {
    resourceTypes?: types.AzExtResourceType[];
    childItemFilter?: types.ContextValueFilter;
}

export class QuickPickAppResourceStep extends GenericQuickPickStep<AzureResourceQuickPickWizardContext, AppResourceQuickPickOptions> {
    protected override async promptInternal(wizardContext: AzureResourceQuickPickWizardContext): Promise<AzureResourceItem> {
        const pickedAppResource = (await super.promptInternal(wizardContext)) as unknown as AzureResourceItem;

        // TODO
        wizardContext.resource = pickedAppResource.resource;
        wizardContext.resourceGroup = pickedAppResource.resource.resourceGroup;

        return pickedAppResource;
    }

    protected readonly pickFilter: PickFilter = new AppResourcePickFilter(this.pickOptions);
}

class AppResourcePickFilter implements PickFilter {

    constructor(private readonly pickOptions: AppResourceQuickPickOptions) { }

    isFinalPick(node: TreeItem): boolean {
        // If childItemFilter is defined, this cannot be a direct pick
        if (this.pickOptions.childItemFilter) {
            return false;
        }

        return this.matchesResourceType(parseContextValue(node.contextValue));
    }

    isAncestorPick(node: TreeItem): boolean {
        // If childItemFilter is undefined, this cannot be an indirect pick
        if (!this.pickOptions.childItemFilter) {
            return false;
        }

        return this.matchesResourceType(parseContextValue(node.contextValue));
    }

    private matchesResourceType(contextValues: string[]): boolean {
        if (!contextValues.includes('azureResource')) {
            return false;
        }

        return !this.pickOptions.resourceTypes || this.pickOptions.resourceTypes.some((type) => contextValues.includes(type));
    }
}
