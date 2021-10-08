/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as url from "url";
import { Progress } from "vscode";
import { AzureWizardExecuteStep } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { createCosmosDBClient } from "../utils/azureClients";
import { localize } from "../utils/localize";
import { nonNullProp } from "../utils/nonNull";
import { IConnectDBWizardContext } from "./IConnectDBWizardContext";
import * as azureUtils from "../utils/azureUtils";


export class DatabaseConnectionCreateStep extends AzureWizardExecuteStep<IConnectDBWizardContext> {
    public priority: number = 200;
    public async execute(context: IConnectDBWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const creatingMessage: string = localize('creatingDatabasesConnection', 'Creating Databases connection...');
        ext.outputChannel.appendLog(creatingMessage);
        progress.report({ message: creatingMessage });
        if (context.server) {
            const hostName = nonNullProp(context.server, 'name');
            const port = '5432';
            const serverType = nonNullProp(context.server, 'serverType');
            const username = serverType === 'Flexible' ? nonNullProp(context, 'shortUserName') : nonNullProp(context, 'longUserName');
            const password = nonNullProp(context, 'adminPassword');
            const serverId = nonNullProp(context.server, 'id');
            const connectionString = `postgresql://${hostName}:${username}@${hostName}:${port}`;
            const postgresData = { username: username, password: password, serverType: serverType };
            const azureData = { accountName: hostName, accountId: serverId, resourceGroup: context.resourceGroup?.name };
            context.databaseConnectionTreeItem = { hostName, port, connectionString, azureData, postgresData };
        } else if (context.databaseAccount) {
            const hostName = nonNullProp(context.databaseAccount, 'name');
            const accountId = nonNullProp(context.databaseAccount, 'id');
            const azureData = { accountName: hostName, accountId, resourceGroup: context.resourceGroup?.name };
            const cosmosClient = await createCosmosDBClient(context);
            const masterKeyResult = (await cosmosClient.databaseAccounts.listKeys(azureUtils.azureUtils.getResourceGroupFromId(accountId), hostName))._response.parsedBody;
            const masterKey = nonNullProp(masterKeyResult, 'primaryMasterKey');
            const documentEndpoint = nonNullProp(context.databaseAccount, 'documentEndpoint');
            let connectionString: string | undefined;
            const result = (await cosmosClient.databaseAccounts.listConnectionStrings(azureUtils.azureUtils.getResourceGroupFromId(accountId), hostName))._response.parsedBody;
            if (context.defaultExperience && context.defaultExperience.api === "MongoDB") {
                const connectionStringURL: url.URL = new url.URL(nonNullProp(nonNullProp(result, 'connectionStrings')[0], 'connectionString'));
                // for any Mongo connectionString, append this query param because the Cosmos Mongo API v3.6 doesn't support retrywrites
                // but the newer node.js drivers started breaking this
                const searchParam: string = 'retrywrites';
                if (!connectionStringURL.searchParams.has(searchParam)) {
                    connectionStringURL.searchParams.set(searchParam, 'false');
                }
                connectionString = connectionStringURL.toString();
            } else {
                connectionString = `AccountEndpoint=${documentEndpoint};AccountKey=${masterKey}`;
            }
            const port = nonNullProp(url.parse(documentEndpoint), 'port');
            context.databaseConnectionTreeItem = { hostName, port, connectionString, azureData, docDBData: { masterKey, documentEndpoint } };
        }
    }

    public shouldExecute(context: IConnectDBWizardContext): boolean {
        return !!context.server || !!context.databaseAccount || !!context.databaseAccountName;
    }
}

