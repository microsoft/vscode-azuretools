/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { IConnectDBWizardContext } from './IConnectDBWizardContext';
import { nonNullProp } from '../utils/nonNull';
import { createCosmosDBClient, createPostgreSQLClient, createPostgreSQLFlexibleClient } from "../utils/azureClients";
import { localize } from '../utils/localize';
import { uiUtils } from '@microsoft/vscode-azext-azureutils';

export class DatabaseNameStep extends AzureWizardPromptStep<IConnectDBWizardContext> {

    public async prompt(context: IConnectDBWizardContext): Promise<void> {
        const databaseTreeItem = nonNullProp(context, 'databaseConnectionTreeItem');
        const azureData = nonNullProp(databaseTreeItem, 'azureData');
        const databaseNamePlaceholder = localize('databaseNamePlaceholder', 'Database Name');
        const databaseNamePrompt = localize('databaseNamePrompt', 'Provide a database name');
        if (azureData.accountKind?.includes('SQL')) {
            const client = await createCosmosDBClient(context);
            const listOfDatabases: string[] = [];
            (await uiUtils.listAllIterator(client.sqlResources.listSqlDatabases(nonNullProp(azureData, 'resourceGroup'), azureData.accountName))).forEach(db => { if (db) { listOfDatabases.push(nonNullProp(db, 'name')) } });
            context.databaseName = (await context.ui.showInputBox({
                placeHolder: databaseNamePlaceholder,
                prompt: databaseNamePrompt,
                validateInput: (name: string) => validateCoreDatabaseName(name, listOfDatabases)
            })).trim();
        } else if (azureData.accountKind === 'MongoDB') {
            const client = await createCosmosDBClient(context);
            const listOfDatabases: string[] = [];
            (await uiUtils.listAllIterator(client.mongoDBResources.listMongoDBDatabases(nonNullProp(azureData, 'resourceGroup'), azureData.accountName))).forEach(db => { if (db) { listOfDatabases.push(nonNullProp(db, 'name')) } });
            context.databaseName = (await context.ui.showInputBox({
                placeHolder: databaseNamePlaceholder,
                prompt: databaseNamePrompt,
                validateInput: (name: string) => validateMongoDatabaseName(name, listOfDatabases)
            })).trim();
        } else if (databaseTreeItem.postgresData?.serverType === 'Flexible') {
            const postgresFlexibleClient = await createPostgreSQLFlexibleClient(context);
            const listOfDatabases: string[] = [];
            (await uiUtils.listAllIterator(postgresFlexibleClient.databases.listByServer(nonNullProp(azureData, 'resourceGroup'), azureData.accountName))).forEach(db => { if (db) { listOfDatabases.push(nonNullProp(db, 'name')) } });
            context.databaseName = (await context.ui.showInputBox({
                placeHolder: databaseNamePlaceholder,
                prompt: databaseNamePrompt,
                validateInput: (name: string) => validatePostgresDatabaseName(name, listOfDatabases)
            })).trim();
        } else {
            const postgresSingleClient = await createPostgreSQLClient(context);
            const listOfDatabases: string[] = [];
            (await uiUtils.listAllIterator(postgresSingleClient.databases.listByServer(nonNullProp(azureData, 'resourceGroup'), azureData.accountName))).forEach(db => { if (db) { listOfDatabases.push(nonNullProp(db, 'name')) } });
            context.databaseName = (await context.ui.showInputBox({
                placeHolder: databaseNamePlaceholder,
                prompt: databaseNamePrompt,
                validateInput: (name: string) => validatePostgresDatabaseName(name, listOfDatabases)
            })).trim();
        }
        context.valuesToMask.push(context.databaseName);

    }

    public shouldPrompt(context: IConnectDBWizardContext): boolean {
        return !context.databaseName;
    }

}

function validateCoreDatabaseName(name: string, listOfDatabases: string[]): string | undefined | null {
    if (!name) {
        return localize('NameCannotBeEmpty', 'Name cannot be empty.');
    }
    if (listOfDatabases.includes(name)) {
        return localize('NameExists', 'Database "{0}" already exists.', name);
    }
    if (name.length < 1 || name.length > 255) {
        return localize('nameLengthSQL', "Name has to be between 1 and 255 chars long");
    }
    if (name.endsWith(" ")) {
        return localize('nameEndsWithSpaceSQL', "Database name cannot end with space");
    }
    if (/[/\\?#]/.test(name)) {
        return localize('nameContainsCharsSQL', `Database name cannot contain the characters '\\', '/', '#', '?'`);
    }
    return undefined;
}

async function validatePostgresDatabaseName(name: string, listOfDatabases: string[]): Promise<string | undefined | null> {
    if (!name) {
        return localize('NameCannotBeEmpty', 'Name cannot be empty.');
    }
    if (listOfDatabases.includes(name)) {
        return localize('NameExists', 'Database "{0}" already exists.', name);
    }
    return undefined;
}

function validateMongoDatabaseName(name: string, listOfDatabases: string[]): string | undefined | null {
    // https://docs.mongodb.com/manual/reference/limits/#naming-restrictions
    // "#?" are restricted characters for CosmosDB - MongoDB accounts
    if (!name) {
        return localize('NameCannotBeEmpty', 'Name cannot be empty.');
    }
    if (listOfDatabases.includes(name)) {
        return localize('NameExists', 'Database "{0}" already exists.', name);
    }
    const min = 1;
    const max = 63;
    if (name.length < min || name.length > max) {
        return localize('nameLengthMongo', `Database name must be between ${min} and ${max} characters.`);
    }
    if (/[/\\. "$#?]/.test(name)) {
        return localize('nameContainCharsMongo', "Database name cannot contain these characters - `/\\. \"$#?`");
    }
    return undefined;
}



