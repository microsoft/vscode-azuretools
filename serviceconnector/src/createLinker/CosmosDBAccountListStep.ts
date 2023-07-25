/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtPipelineResponse, sendRequestWithTimeout } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export interface DatabaseJsonResponse {
    value: DatabaseAccountJsonResponse[];
}

export interface DatabaseAccountJsonResponse {
    id: string;
    name: string;
    kind: string;
}

export class CosmosDBAccountListStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const placeHolder: string = vscode.l10n.t('Select a Database Account');
        const accounts = await getCosmosDBDatabaseAccounts(context);
        context.databaseAccount = (await context.ui.showQuickPick(this.getPicks(accounts.value), { placeHolder })).data;
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.databaseAccount;
    }

    private async getPicks(accounts: DatabaseAccountJsonResponse[]): Promise<IAzureQuickPickItem<DatabaseAccountJsonResponse>[]> {
        return accounts.map(d => {
            return { label: d.name, description: d.kind, data: d };
        });
    }
}

async function getCosmosDBDatabaseAccounts(context: ICreateLinkerContext): Promise<DatabaseJsonResponse> {
    const url = `https://management.azure.com/subscriptions/${context.subscriptionId}/providers/Microsoft.DocumentDB/databaseAccounts?api-version=2023-03-15`
    return (<AzExtPipelineResponse>await sendRequestWithTimeout(context, { url, method: 'GET' }, 5000, context)).parsedBody as DatabaseJsonResponse;
}
