/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { INewStorageAccountDefaults, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, IAzureQuickPickItem, IWizardOptions } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { TargetServiceType, TargetServiceTypeName } from "../../constants";
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class TargetServiceTypeStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const targetServiceLabels: string[] = [
            vscode.l10n.t('Azure Storage - Blob'),
            vscode.l10n.t('Azure Storage - Queue'),
            vscode.l10n.t('Azure Storage - Table'),
            vscode.l10n.t('Azure Storage - File'),
        ];

        const placeHolder = vscode.l10n.t('Select Target Service Type');
        const picks: IAzureQuickPickItem<TargetServiceType>[] = [
            { label: targetServiceLabels[0], data: { name: "storageBlob", type: TargetServiceTypeName.storage, id: '/blobServices/default' } },
            { label: targetServiceLabels[1], data: { name: "storageQueue", type: TargetServiceTypeName.storage, id: '/queueServices/default' } },
            { label: targetServiceLabels[2], data: { name: "storageTable", type: TargetServiceTypeName.storage, id: '/tableServices/default' } },
            { label: targetServiceLabels[3], data: { name: "storageFile", type: TargetServiceTypeName.storage, id: '/fileServices/default' } },
        ];

        context.targetServiceType = (await context.ui.showQuickPick(picks, { placeHolder })).data
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
            case TargetServiceTypeName.storage:
                promptSteps.push(new StorageAccountListStep(storageAccountCreateOptions));
                break;
            //case for each database type
        }
        return { promptSteps };
    }
}





