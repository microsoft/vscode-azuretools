/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import * as types from '../../index';
import { createAzureClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';

export class ResourceGroupCreateStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> implements types.ResourceGroupCreateStep<T> {
    public async execute(wizardContext: T): Promise<void> {
        // tslint:disable-next-line:no-non-null-assertion
        const newName: string = wizardContext.newResourceGroupName!;
        // tslint:disable-next-line:no-non-null-assertion
        const newLocation: string = wizardContext.location!.name!;
        const resourceClient: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
        const rgExists: boolean = await resourceClient.resourceGroups.checkExistence(newName);
        if (rgExists) {
            ext.outputChannel.appendLine(localize('existingResourceGroup', 'Using existing resource group "{0}".', newName));
            wizardContext.resourceGroup = await resourceClient.resourceGroups.get(newName);
        } else {
            ext.outputChannel.appendLine(localize('creatingResourceGroup', 'Creating resource group "{0}" in location "{1}"...', newName, newLocation));
            wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(newName, { location: newLocation });
            ext.outputChannel.appendLine(localize('createdResourceGroup', 'Successfully created resource group "{0}".', newName));
        }
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.resourceGroup;
    }
}
