/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceGroup, ResourceManagementClient } from '@azure/arm-resources';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp, parseError } from '@microsoft/vscode-azext-utils';
import { l10n, MessageItem, Progress } from 'vscode';
import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { resourcesProvider } from '../constants';
import { ext } from '../extensionVariables';
import { uiUtils } from '../utils/uiUtils';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupListStep } from './ResourceGroupListStep';

export class ResourceGroupCreateStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> implements types.ResourceGroupCreateStep<T> {
    protected getTreeItemLabel(context: T): string {
        const newName: string = nonNullProp(context, 'newResourceGroupName');
        return this._usedExistingResourceGroup ?
            l10n.t('Using existing resource group "{0}".', newName) :
            l10n.t('Create resource group "{0}"', newName);
    }
    protected getOutputLogSuccess(context: T): string {
        const newName: string = nonNullProp(context, 'newResourceGroupName');
        return this._usedExistingResourceGroup ?
            l10n.t('Successfully used existing resource group "{0}".', newName) :
            l10n.t('Successfully created resource group "{0}".', newName);
    }
    protected getOutputLogFail(context: T): string {
        const newName: string = nonNullProp(context, 'newResourceGroupName');
        return l10n.t('Failed to create resource group "{0}".', newName);
    }
    protected getOutputLogProgress(context: T): string {
        const newName: string = nonNullProp(context, 'newResourceGroupName');
        return l10n.t('Creating resource group "{0}"...', newName);
    }

    public priority: number = 100;
    public stepName: string = 'CreateResourceGroupStep';
    private _usedExistingResourceGroup: boolean = false;

    public async execute(wizardContext: T, _progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const newName: string = wizardContext.newResourceGroupName!;
        const newLocation = await LocationListStep.getLocation(wizardContext, resourcesProvider, false);
        const newLocationName: string = newLocation.name;
        const resourceClient: ResourceManagementClient = await createResourcesClient(wizardContext);
        try {
            const rgExists: boolean = (await resourceClient.resourceGroups.checkExistence(newName)).body;
            if (rgExists) {
                wizardContext.resourceGroup = await resourceClient.resourceGroups.get(newName);
                this._usedExistingResourceGroup = true;
            } else {
                wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(newName, { location: newLocationName });
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
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        ext.outputChannel.appendLog(l10n.t('WARNING: Cannot create resource group "{0}" because the selected subscription is a concierge subscription. Using resource group "{1}" instead.', newName, wizardContext.resourceGroup!.name!))
                        return undefined;
                    }
                }

                const message: string = l10n.t('You do not have permission to create a resource group in subscription "{0}".', wizardContext.subscriptionDisplayName);
                const selectExisting: MessageItem = { title: l10n.t('Select Existing') };
                await wizardContext.ui.showWarningMessage(message, { modal: true, stepName: 'RgNoPermissions' }, selectExisting);

                wizardContext.telemetry.properties.forbiddenResponse = 'SelectExistingRg';
                const step: ResourceGroupListStep<T> = new ResourceGroupListStep(true /* suppressCreate */);
                await step.prompt(wizardContext);
                this._usedExistingResourceGroup = true;
            }
        }
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.resourceGroup;
    }
}
