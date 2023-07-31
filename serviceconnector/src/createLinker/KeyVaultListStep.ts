/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtPipelineResponse, sendRequestWithTimeout } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export interface KeyVaultJsonResponse {
    value: KeyVaultAccountJsonResponse[];
}

export interface KeyVaultAccountJsonResponse {
    id: string;
    name: string;
}

export class KeyVaultListStep extends AzureWizardPromptStep<ICreateLinkerContext> {
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const placeHolder: string = vscode.l10n.t('Select a key vault');
        const accounts = await getKeyVaultAccounts(context);
        context.keyVaultAccount = (await context.ui.showQuickPick(this.getPicks(accounts.value), { placeHolder })).data;
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.keyVaultAccount;
    }

    private async getPicks(accounts: KeyVaultAccountJsonResponse[]): Promise<IAzureQuickPickItem<KeyVaultAccountJsonResponse>[]> {
        return accounts.map(d => {
            return { label: d.name, data: d };
        });
    }
}

async function getKeyVaultAccounts(context: ICreateLinkerContext): Promise<KeyVaultJsonResponse> {
    const url = `${context.environment.resourceManagerEndpointUrl}subscriptions/${context.subscriptionId}/resources?$filter=resourceType eq 'Microsoft.KeyVault/vaults'&api-version=2015-11-01`;
    return (<AzExtPipelineResponse>await sendRequestWithTimeout(context, { url, method: 'GET' }, 5000, context)).parsedBody as KeyVaultJsonResponse;
}
