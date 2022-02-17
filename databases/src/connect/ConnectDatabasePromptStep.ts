/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardExecuteStep, AzureWizardPromptStep, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions } from "@microsoft/vscode-azext-utils";
import { API, CoreExperience } from "../create/AzureDBExperiences";
import { createCosmosDBClient, createPostgreSQLClient, createPostgreSQLFlexibleClient } from "../utils/azureClients";
import { localize } from "../utils/localize";
import { nonNullProp } from "../utils/nonNull";
import { DatabaseCreateStep } from "./DatabaseCreateStep";
import { DatabaseNameStep } from "./DatabaseNameStep";
import { IConnectDBWizardContext } from "./IConnectDBWizardContext";

export class ConnectDatabasePromptStep extends AzureWizardPromptStep<IConnectDBWizardContext> {
    private _suppressCreate: boolean | undefined;

    public constructor(suppressCreate: boolean | undefined) {
        super();
        this._suppressCreate = suppressCreate;
    }

    public static async getPostgresDatabases(context: IConnectDBWizardContext): Promise<(string | undefined)[]> {

        const databaseTreeItem = nonNullProp(context, 'databaseConnectionTreeItem');
        const postgresSingleClient = await createPostgreSQLClient(context);
        const postgresFlexibleClient = await createPostgreSQLFlexibleClient(context);
        const databases: (string | undefined)[] = [];
        const adminDatabases = ['azure_maintenance', 'azure_sys'];
        const azureData = nonNullProp(databaseTreeItem, 'azureData');
        const resourceGroupName = nonNullProp(azureData, 'resourceGroup');
        if (databaseTreeItem.postgresData?.serverType === 'Single') {
            (await uiUtils.listAllIterator(postgresSingleClient.databases.listByServer(resourceGroupName, azureData.accountName))).forEach(database => { if (database.name && !adminDatabases.includes(database.name)) databases.push(database.name) });
        } else if (databaseTreeItem.postgresData?.serverType === 'Flexible') {
            (await uiUtils.listAllIterator(postgresFlexibleClient.databases.listByServer(resourceGroupName, azureData.accountName))).forEach(database => { if (database.name && !adminDatabases.includes(database.name)) databases.push(database.name) });
        }
        return databases;

    }

    public static async getCosmosDatabases(context: IConnectDBWizardContext): Promise<(string | undefined)[]> {

        const databaseTreeItem = nonNullProp(context, 'databaseConnectionTreeItem');
        const cosmosClient = await createCosmosDBClient(context);
        const databases: string[] = [];
        const azureData = nonNullProp(databaseTreeItem, 'azureData');
        const resourceGroup = nonNullProp(azureData, 'resourceGroup');
        if (context.databaseConnectionTreeItem?.azureData?.accountKind === API.MongoDB) {
            const mongoDBResult = await uiUtils.listAllIterator(cosmosClient.mongoDBResources.listMongoDBDatabases(resourceGroup, azureData.accountName));
            mongoDBResult.forEach(mongoDB => {
                databases.push(nonNullProp(mongoDB, 'name'));
            });
        }
        if (context.databaseConnectionTreeItem?.azureData?.accountKind?.includes(CoreExperience.shortName)) {
            const sqlDBResult = await uiUtils.listAllIterator(cosmosClient.sqlResources.listSqlDatabases(resourceGroup, azureData.accountName));
            sqlDBResult.forEach(sqlDB => {
                databases.push(nonNullProp(sqlDB, 'name'));
            });
        }
        return databases;

    }

    public async prompt(context: IConnectDBWizardContext): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: 'Add Database Connection.' };
        const input: IAzureQuickPickItem<string | undefined> = await context.ui.showQuickPick(this.getQuickPickItems(context), options);
        if (input.data) {
            if (context.databaseConnectionTreeItem?.databaseName) context.databaseConnectionTreeItem.databaseName = input.data;
            context.databaseName = input.data;
            const databaseTreeItem = nonNullProp(context, 'databaseConnectionTreeItem');
            databaseTreeItem.databaseName = input.data;
        } else if (input.label.includes('Create new Database')) {
            context.createNewDatabase = true;
        }
    }

    public shouldPrompt(context: IConnectDBWizardContext): boolean {
        return (!!context.databaseConnectionTreeItem || !!context.server || !!context.databaseAccount) && !context.databaseName;
    }

    public async getSubWizard(context: IConnectDBWizardContext): Promise<IWizardOptions<IConnectDBWizardContext> | undefined> {
        if (context.createNewDatabase) {
            const promptSteps: AzureWizardPromptStep<IConnectDBWizardContext>[] = [new DatabaseNameStep()];
            const executeSteps: AzureWizardExecuteStep<IConnectDBWizardContext>[] = [new DatabaseCreateStep()];
            return {
                promptSteps: promptSteps,
                executeSteps: executeSteps
            }
        }
        return undefined;
    }

    private async getQuickPickItems(context: IConnectDBWizardContext): Promise<IAzureQuickPickItem<string | undefined>[]> {
        const picks: IAzureQuickPickItem<string | undefined>[] = !this._suppressCreate ? [{
            label: localize('newDBConnection', '$(plus) Create new Database'),
            data: undefined
        }] : [];

        let components: (string | undefined)[] = [];
        if (context.databaseConnectionTreeItem?.azureData?.accountKind?.toLowerCase().includes('postgres')) {
            components = await ConnectDatabasePromptStep.getPostgresDatabases(context);
        } else {
            components = await ConnectDatabasePromptStep.getCosmosDatabases(context);
        }
        const items: IAzureQuickPickItem<string | undefined>[] = components.map((c: string | undefined) => <IAzureQuickPickItem<string>>{ label: c, data: c });
        picks.push(...items);
        return picks;
    }

}
