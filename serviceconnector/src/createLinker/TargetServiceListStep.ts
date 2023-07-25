/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { INewStorageAccountDefaults, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, IAzureQuickPickItem, IWizardOptions } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { TargetServiceType, TargetServiceTypeName } from "../../constants";
import { CosmosDBAccountListStep } from "./CosmosDBAccountListStep";
import { ICreateLinkerContext } from "./ICreateLinkerContext";
import { KeyVaultListStep } from "./KeyVaultListStep";

export class TargetServiceListStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const placeHolder = vscode.l10n.t('Select Target Service Type');
        const picks: IAzureQuickPickItem<TargetServiceType>[] = [
            { label: vscode.l10n.t('Blob'), data: { name: "storageBlob", type: TargetServiceTypeName.Storage, id: '/blobServices/default' }, group: TargetServiceTypeName.Storage },
            { label: vscode.l10n.t('Queue'), data: { name: "storageQueue", type: TargetServiceTypeName.Storage, id: '/queueServices/default' }, group: TargetServiceTypeName.Storage },
            { label: vscode.l10n.t('Table'), data: { name: "storageTable", type: TargetServiceTypeName.Storage, id: '/tableServices/default' }, group: TargetServiceTypeName.Storage },
            { label: vscode.l10n.t('File'), data: { name: "storageFile", type: TargetServiceTypeName.Storage, id: '/fileServices/default' }, group: TargetServiceTypeName.Storage },
            { label: vscode.l10n.t('CosmosDB'), data: { name: "cosmosDB", type: TargetServiceTypeName.CosmosDB, id: '/databases' }, group: TargetServiceTypeName.CosmosDB },
            { label: vscode.l10n.t('Key Vault'), data: { name: "keyVault", type: TargetServiceTypeName.KeyVault, id: '/keyVault' }, group: TargetServiceTypeName.KeyVault },
        ];

        context.targetServiceType = (await context.ui.showQuickPick(picks, { placeHolder, enableGrouping: true })).data
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.targetServiceType;
    }

    public async getSubWizard(context: ICreateLinkerContext): Promise<IWizardOptions<ICreateLinkerContext> | undefined> {
        const promptSteps: AzureWizardPromptStep<ICreateLinkerContext>[] = [];

        const storageAccountCreateOptions: INewStorageAccountDefaults = {
            kind: StorageAccountKind.Storage,
            performance: StorageAccountPerformance.Standard,
            replication: StorageAccountReplication.LRS
        };

        switch (context.targetServiceType?.type) {
            case TargetServiceTypeName.Storage:
                promptSteps.push(new StorageAccountListStep(storageAccountCreateOptions));
                break;
            case TargetServiceTypeName.CosmosDB:
                promptSteps.push(new CosmosDBAccountListStep());
                break;
            case TargetServiceTypeName.KeyVault:
                promptSteps.push(new KeyVaultListStep());
        }
        return { promptSteps };
    }
}
