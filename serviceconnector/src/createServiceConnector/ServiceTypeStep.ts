/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { INewStorageAccountDefaults, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, IAzureQuickPickItem, IWizardOptions } from "@microsoft/vscode-azext-utils";
import { ServiceType, ServiceTypeNames } from "../../constants";
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class ServiceTypeStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const placeHolder = 'Select Target Service Type';
        const picks: IAzureQuickPickItem<ServiceType>[] = [
            { label: 'Azure Storage - Blob', data: { name: "storageBlob", type: ServiceTypeNames.storage, id: '/blobServices/default' } },
            { label: 'Azure Storage - Queue', data: { name: "storageQueue", type: ServiceTypeNames.storage, id: '/queueServices/default' } },
            { label: 'Azure Storage - Table', data: { name: "storageTable", type: ServiceTypeNames.storage, id: '/tableServices/default' } },
            { label: 'Azure Storage - File', data: { name: "storageFile", type: ServiceTypeNames.storage, id: '/fileServices/default' } },
        ];

        context.serviceType = (await context.ui.showQuickPick(picks, { placeHolder })).data
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.serviceType;
    }

    public async getSubWizard(context: ICreateLinkerContext): Promise<IWizardOptions<ICreateLinkerContext> | undefined> {
        const promptSteps: AzureWizardPromptStep<ICreateLinkerContext>[] = [];

        const storageAccountCreateOptions: INewStorageAccountDefaults = {
            kind: StorageAccountKind.Storage,
            performance: StorageAccountPerformance.Standard,
            replication: StorageAccountReplication.LRS
        };

        switch (context.serviceType?.type) {
            case ServiceTypeNames.storage:
                promptSteps.push(new StorageAccountListStep(storageAccountCreateOptions));
                break;
            //case for each database type
        }
        return { promptSteps };
    }
}





