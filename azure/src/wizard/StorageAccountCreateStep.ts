/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SkuName } from '@azure/arm-storage';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp } from '@microsoft/vscode-azext-utils';
import { l10n, Progress } from 'vscode';
import { INewStorageAccountDefaults, IStorageAccountWizardContext } from '../types';
import { createStorageClient } from '../clients';
import { storageProvider } from '../constants';
import { LocationListStep } from './LocationListStep';

export class StorageAccountCreateStep<T extends IStorageAccountWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    stepName: string = 'StorageAccountCreateStep';
    /**
     * 130
     */
    public priority: number = 130;

    private readonly _defaults: INewStorageAccountDefaults;

    public constructor(defaults: INewStorageAccountDefaults) {
        super();
        this._defaults = defaults;
    }

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        progress.report({ message: l10n.t('Creating storage account...') });

        const newLocation: string = (await LocationListStep.getLocation(wizardContext, storageProvider)).name;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const newName: string = wizardContext.newStorageAccountName!;
        const newSkuName: SkuName = `${this._defaults.performance}_${this._defaults.replication}`;
        const storageClient = await createStorageClient(wizardContext);
        wizardContext.storageAccount = await storageClient.storageAccounts.beginCreateAndWait(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            wizardContext.resourceGroup!.name!,
            newName,
            {
                sku: { name: newSkuName },
                kind: this._defaults.kind,
                location: newLocation,
                enableHttpsTrafficOnly: true,
                allowBlobPublicAccess: false,
                defaultToOAuthAuthentication: true,
                allowSharedKeyAccess: !wizardContext.disableSharedKeyAccess,
            }
        );
    }

    protected getTreeItemLabel(context: T): string {
        const newName: string = nonNullProp(context, 'newStorageAccountName');
        const newSkuName: SkuName = `${this._defaults.performance}_${this._defaults.replication}`;
        return l10n.t('Create storage account "{0}" with sku "{1}"', newName, newSkuName);
    }
    protected getOutputLogSuccess(context: T): string {
        const newName: string = nonNullProp(context, 'newStorageAccountName');
        const newSkuName: SkuName = `${this._defaults.performance}_${this._defaults.replication}`;
        return l10n.t('Successfully created storage account "{0}" with sku "{1}".', newName, newSkuName);
    }
    protected getOutputLogFail(context: T): string {
        const newName: string = nonNullProp(context, 'newStorageAccountName');
        const newSkuName: SkuName = `${this._defaults.performance}_${this._defaults.replication}`;
        return l10n.t('Failed to create storage account "{0}" with sku "{1}".', newName, newSkuName);
    }

    protected getOutputLogProgress(context: T): string {
        const newName: string = nonNullProp(context, 'newStorageAccountName');
        const newSkuName: SkuName = `${this._defaults.performance}_${this._defaults.replication}`;
        return l10n.t('Creating storage account "{0}" with sku "{1}"...', newName, newSkuName);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.storageAccount;
    }
}
