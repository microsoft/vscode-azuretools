/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from '@azure/arm-resources';
import { MessageItem, Progress } from 'vscode';
import * as types from '../../index';
import { createAzureClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { parseError } from '../parseError';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';
import { ResourceGroupListStep } from './ResourceGroupListStep';

export class ResourceGroupCreateStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> implements types.ResourceGroupCreateStep<T> {
    public priority: number = 100;

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        // tslint:disable-next-line:no-non-null-assertion
        const newName: string = wizardContext.newResourceGroupName!;
        // tslint:disable-next-line:no-non-null-assertion
        const newLocation: string = wizardContext.location!.name!;
        const resourceClient: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
        try {
            const rgExists: boolean = (await resourceClient.resourceGroups.checkExistence(newName)).body;
            if (rgExists) {
                ext.outputChannel.appendLog(localize('existingResourceGroup', 'Using existing resource group "{0}".', newName));
                wizardContext.resourceGroup = await resourceClient.resourceGroups.get(newName);
            } else {
                const creatingMessage: string = localize('creatingResourceGroup', 'Creating resource group "{0}" in location "{1}"...', newName, newLocation);
                ext.outputChannel.appendLog(creatingMessage);
                progress.report({ message: creatingMessage });
                wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(newName, { location: newLocation });
                ext.outputChannel.appendLog(localize('createdResourceGroup', 'Successfully created resource group "{0}".', newName));
            }
        } catch (error) {
            if (wizardContext.suppress403Handling || parseError(error).errorType !== '403') {
                throw error;
            } else {
                const message: string = localize('rgForbidden', 'You do not have permission to create a resource group in subscription "{0}".', wizardContext.subscriptionDisplayName);
                const selectExisting: MessageItem = { title: localize('selectExisting', 'Select Existing') };
                wizardContext.telemetry.properties.cancelStep = 'RgNoPermissions';
                await ext.ui.showWarningMessage(message, { modal: true }, selectExisting);

                wizardContext.telemetry.properties.cancelStep = undefined;
                wizardContext.telemetry.properties.forbiddenResponse = 'SelectExistingRg';
                const step: ResourceGroupListStep<T> = new ResourceGroupListStep(true /* suppressCreate */);
                await step.prompt(wizardContext);
            }
        }
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.resourceGroup;
    }
}
