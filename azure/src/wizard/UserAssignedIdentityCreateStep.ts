/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type ManagedServiceIdentityClient } from '@azure/arm-msi';
import { AzureWizardExecuteStep, nonNullValueAndProp, randomUtils } from '@microsoft/vscode-azext-utils';
import { l10n, Progress } from 'vscode';
import * as types from '../../index';
import { createManagedServiceIdentityClient } from '../clients';
import { storageProvider } from '../constants';
import { ext } from '../extensionVariables';
import { LocationListStep } from './LocationListStep';

/**
 * Naming constraints:
 * The resource name must start with a letter or number,
 * have a length between 3 and 128 characters and
 * can only contain a combination of alphanumeric characters, hyphens and underscores
 * But since we are appending "-identities" to the resource group name and that has the same constraints and a 90 character limit,
 * we don't need to do any verification
 **/
export class UserAssignedIdentityCreateStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> {
    // We should create this immediately after the resource group is created
    public priority: number = 101;

    public constructor() {
        super();
    }

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newLocation: string = (await LocationListStep.getLocation(wizardContext, storageProvider)).name;
        const rgName: string = wizardContext.newResourceGroupName ?? nonNullValueAndProp(wizardContext.resourceGroup, 'name');
        let newName: string | undefined = undefined;
        while (!newName) {
            newName = await this.generateRelatedName(wizardContext, rgName);
        }

        const creatingUserAssignedIdentity: string = l10n.t('Creating user assigned identity "{0}" in location "{1}"...', newName, newLocation);
        ext.outputChannel.appendLog(creatingUserAssignedIdentity);
        progress.report({ message: creatingUserAssignedIdentity });
        const msiClient: ManagedServiceIdentityClient = await createManagedServiceIdentityClient(wizardContext);
        wizardContext.managedIdentity = await msiClient.userAssignedIdentities.createOrUpdate(
            rgName,
            newName,
            {
                location: newLocation
            }
        );
        const createdUserAssignedIdentity: string = l10n.t('Successfully created user assigned identity "{0}".', newName);
        ext.outputChannel.appendLog(createdUserAssignedIdentity);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.managedIdentity;
    }

    private async generateRelatedName(wizardContext: types.IResourceGroupWizardContext, rgName: string): Promise<string | undefined> {
        const newName: string = `${rgName}-identities-${randomUtils.getRandomHexString(6)}`;
        try {
            const msiClient: ManagedServiceIdentityClient = await createManagedServiceIdentityClient(wizardContext);
            await msiClient.userAssignedIdentities.get(rgName, newName);
        } catch (err) {
            return newName;
        }

        // If we get here, the name is already taken. We need to generate a new name.
        return undefined;
    }
}
