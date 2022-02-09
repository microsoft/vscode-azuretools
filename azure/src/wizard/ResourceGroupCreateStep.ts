/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceGroup, ResourceManagementClient } from '@azure/arm-resources';
import { MessageItem, Progress } from 'vscode';
import { AzureWizardExecuteStep, parseError } from '@microsoft/vscode-azext-utils';
import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { resourcesProvider } from '../constants';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupListStep } from './ResourceGroupListStep';

export class ResourceGroupCreateStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> implements types.ResourceGroupCreateStep<T> {
    public priority: number = 100;

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const newName: string = wizardContext.newResourceGroupName!;
        const newLocation = await LocationListStep.getLocation(wizardContext, resourcesProvider, false);
        const newLocationName: string = newLocation.name;
        const resourceClient: ResourceManagementClient = await createResourcesClient(wizardContext);
        try {
            const rgExists: boolean = (await resourceClient.resourceGroups.checkExistence(newName)).body;
            if (rgExists) {
                ext.outputChannel.appendLog(localize('existingResourceGroup', 'Using existing resource group "{0}".', newName));
                wizardContext.resourceGroup = await resourceClient.resourceGroups.get(newName);
            } else {
                const creatingMessage: string = localize('creatingResourceGroup', 'Creating resource group "{0}" in location "{1}"...', newName, newLocationName);
                ext.outputChannel.appendLog(creatingMessage);
                progress.report({ message: creatingMessage });
                wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(newName, { location: newLocationName });
                ext.outputChannel.appendLog(localize('createdResourceGroup', 'Successfully created resource group "{0}".', newName));
            }
        } catch (error) {
            if (wizardContext.suppress403Handling || parseError(error).errorType !== '403') {
                throw error;
            } else {
                // if we suspect that this is a Concierge account, only pick the rg if it begins with "learn" and there is only 1
                if (/concierge/i.test(wizardContext.subscriptionDisplayName)) {
                    const rgs: ResourceGroup[] = await uiUtils.listAllIterator(resourceClient.resourceGroups.list());
                    if (rgs.length === 1 && rgs[0].name && /^learn/i.test(rgs[0].name)) {
                        wizardContext.resourceGroup = rgs[0];
                        wizardContext.telemetry.properties.forbiddenResponse = 'SelectLearnRg';
                        ext.outputChannel.appendLog(localize('usedLearnResourceGroup', 'WARNING: Cannot create resource group "{0}" because the selected subscription is a concierge subscription. Using resource group "{1}" instead.', newName, wizardContext.resourceGroup?.name))
                        return undefined;
                    }
                }

                const message: string = localize('rgForbidden', 'You do not have permission to create a resource group in subscription "{0}".', wizardContext.subscriptionDisplayName);
                const selectExisting: MessageItem = { title: localize('selectExisting', 'Select Existing') };
                await wizardContext.ui.showWarningMessage(message, { modal: true, stepName: 'RgNoPermissions' }, selectExisting);

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
