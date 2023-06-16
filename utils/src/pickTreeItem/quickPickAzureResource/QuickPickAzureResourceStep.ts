/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as types from '../../../index';
import { AzureResourceQuickPickWizardContext } from '../../../index';
import { parseContextValue } from '../../utils/contextUtils';
import { GenericQuickPickStep } from '../GenericQuickPickStep';
import { PickFilter } from '../PickFilter';
import { AzureResourceItem, ResourceGroupsItem } from './tempTypes';

export class QuickPickAzureResourceStep extends GenericQuickPickStep<AzureResourceQuickPickWizardContext, types.AzureResourceQuickPickOptions> {

    public constructor(tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options?: types.AzureResourceQuickPickOptions, promptOptions?: types.IAzureQuickPickOptions) {
        super(tdp, options ?? {}, {
            placeHolder: vscode.l10n.t('Select resource'),
            ...promptOptions,
        });
    }

    protected override async promptInternal(wizardContext: AzureResourceQuickPickWizardContext): Promise<AzureResourceItem> {
        const pickedAzureResource = (await super.promptInternal(wizardContext)) as unknown as AzureResourceItem;

        // TODO
        wizardContext.resource = pickedAzureResource.resource;
        wizardContext.resourceGroup = pickedAzureResource.resource.resourceGroup;

        return pickedAzureResource;
    }

    protected readonly pickFilter: PickFilter = new AzureResourcePickFilter(this.pickOptions);

    protected override async getQuickPickItem(element: AzureResourceItem, item: vscode.TreeItem): Promise<types.IAzureQuickPickItem<unknown>> {
        return {
            ...await super.getQuickPickItem(element, item),
            description: element.resource.resourceGroup,
        };
    }
}

class AzureResourcePickFilter implements PickFilter {

    constructor(private readonly pickOptions: types.AzureResourceQuickPickOptions) { }

    isFinalPick(node: vscode.TreeItem): boolean {
        // If childItemFilter is defined, this cannot be a direct pick
        if (this.pickOptions.childItemFilter) {
            return false;
        }

        return this.matchesResourceType(parseContextValue(node.contextValue));
    }

    isAncestorPick(node: vscode.TreeItem): boolean {
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
