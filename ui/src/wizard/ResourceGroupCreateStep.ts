/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { OutputChannel } from 'vscode';
import { IResourceGroupWizardContext } from '../../index';
import { localize } from '../localize';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';

export class ResourceGroupCreateStep<T extends IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> {
    public async execute(wizardContext: T, outputChannel: OutputChannel): Promise<T> {
        if (!wizardContext.resourceGroup) {
            // tslint:disable-next-line:no-non-null-assertion
            const newName: string = wizardContext.newResourceGroupName!;
            // tslint:disable-next-line:no-non-null-assertion
            const newLocation: string = wizardContext.location!.name!;
            outputChannel.appendLine(localize('CreatingResourceGroup', 'Ensuring resource group "{0}" in location "{1} exists"...', newName, newLocation));
            const resourceClient: ResourceManagementClient = new ResourceManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
            wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(newName, { location: newLocation });
            outputChannel.appendLine(localize('CreatedResourceGroup', 'Successfully found resource group "{0}".', newName));
        }

        return wizardContext;
    }
}
