/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Progress } from 'vscode';
import { AzureWizardExecuteStep } from 'vscode-azureextensionui';
import { IConnectDBWizardContext } from './IConnectDBWizardContext';
import { ext } from '../extensionVariables';
import { createCosmosDBClient, createPostgreSQLClient, createPostgreSQLFlexibleClient } from '../utils/azureClients';
import { localize } from '../utils/localize';
import { nonNullProp } from '../utils/nonNull';
import { API, CoreExperience } from '../create/AzureDBExperiences';
import { PostgresServerType } from '../create/PostgresAccountWizard/abstract/models';

export class DatabaseCreateStep extends AzureWizardExecuteStep<IConnectDBWizardContext> {
    public shouldExecute(context: IConnectDBWizardContext): boolean {
        return !!context.databaseName && !!context.createNewDatabase;
    }
    public priority: number = 130;

    public async execute(context: IConnectDBWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {

        const databaseTreeItem = nonNullProp(context, 'databaseConnectionTreeItem');
        const azureData = nonNullProp(databaseTreeItem, 'azureData');
        const resourceGroupName = nonNullProp(azureData, 'resourceGroup');
        const databaseName = nonNullProp(context, 'databaseName');
        const creatingMessage: string = localize('creatingDatabasesConnection', 'Creating Databases connection...');
        ext.outputChannel.appendLog(creatingMessage);
        progress.report({ message: creatingMessage });
        if (azureData?.accountKind?.includes(CoreExperience.shortName)) {
            const client = createCosmosDBClient(context);
            await (await client).sqlResources.createUpdateSqlDatabase(resourceGroupName, azureData.accountName, databaseName, { resource: { id: databaseName }, options: {} });
        } else if (azureData.accountKind === API.MongoDB) {
            const client = createCosmosDBClient(context);
            await (await client).mongoDBResources.createUpdateMongoDBDatabase(resourceGroupName, azureData.accountName, databaseName, { resource: { id: databaseName }, options: {} });
        } else if (databaseTreeItem.postgresData?.serverType === PostgresServerType.Single) {
            const client = createPostgreSQLClient(context);
            await (await client).databases.createOrUpdate(resourceGroupName, azureData.accountName, databaseName, {});
        } else if (databaseTreeItem.postgresData?.serverType === PostgresServerType.Flexible) {
            const client = createPostgreSQLFlexibleClient(context);
            await (await client).databases.create(resourceGroupName, azureData.accountName, databaseName, {});
        }
        databaseTreeItem.databaseName = context.databaseName;
        const completedMessage: string = localize('createdConnection', 'Successfully created new Database {0}', context.databaseName);
        ext.outputChannel.appendLog(completedMessage);
    }
}

