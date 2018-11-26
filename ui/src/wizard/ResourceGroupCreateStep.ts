/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { IResourceGroupWizardContext } from '../../index';
import { createAzureClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';

export class ResourceGroupCreateStep<T extends IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> {
    public async execute(wizardContext: T): Promise<T> {
        if (!wizardContext.resourceGroup) {
            // tslint:disable-next-line:no-non-null-assertion
            const newName: string = wizardContext.newResourceGroupName!;
            // tslint:disable-next-line:no-non-null-assertion
            const newLocation: string = wizardContext.location!.name!;
            const findingResourceGroup: string = localize('creatingResourceGroup', 'Ensuring resource group "{0}" in location "{1}" exists...', newName, newLocation);
            const foundResourceGroup: string = localize('createdResourceGroup', 'Successfully found resource group "{0}".', newName);
            ext.outputChannel.appendLine(findingResourceGroup);
            const resourceClient: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
            wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(newName, { location: newLocation });
            ext.outputChannel.appendLine(foundResourceGroup);
        }

        return wizardContext;
    }
}
