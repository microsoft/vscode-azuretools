/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DatabaseAccountsListResult } from "@azure/arm-cosmosdb/src/models";
import { URL } from "url";
import { AzureWizardPromptStep, IAzureQuickPickItem, IAzureQuickPickOptions, ILocationWizardContext, IWizardOptions, LocationListStep, ResourceGroupListStep } from "vscode-azureextensionui";
import * as azureUtils from "../utils/azureUtils";
import { AzureDBAPIStep } from "../create/AzureDBAPIStep";
import { API, getExperienceLabel, tryGetExperience } from "../create/AzureDBExperiences";
import { PostgresServerType } from "../create/PostgresAccountWizard/abstract/models";
import { createCosmosDBClient, createPostgreSQLClient, createPostgreSQLFlexibleClient } from "../utils/azureClients";
import { localize } from "../utils/localize";
import { nonNullProp } from "../utils/nonNull";
import { DBTreeItem } from "./DBTreeItem";
import { IConnectDBWizardContext } from "./IConnectDBWizardContext";

const skipForNowLabel: string = '$(clock) Skip for now';

export class ConnectDatabaseAccountPromptStep extends AzureWizardPromptStep<IConnectDBWizardContext> {
    private _suppressCreate: boolean | undefined;
    private _suppressSkip: boolean | undefined;

    public constructor(suppressCreate: boolean | undefined, suppressSkip: boolean | undefined) {
        super();
        this._suppressCreate = suppressCreate;
        this._suppressSkip = suppressSkip;
    }

    public static async getPostgresDatabases(wizardContext: IConnectDBWizardContext, api?: API): Promise<(DBTreeItem)[]> {

        const databaseItems: (DBTreeItem)[] = [];
        if (api) {
            if (api === API.PostgresSingle) {
                const postgresSingleClient = await createPostgreSQLClient(wizardContext);
                const postgresSingleServers = [
                    ...(await postgresSingleClient.servers.list()).map(s => Object.assign(s, { serverType: PostgresServerType.Single })),
                ];
                databaseItems.push(...postgresSingleServers.map(server => <DBTreeItem>{ hostName: nonNullProp(server, 'fullyQualifiedDomainName'), port: '5432', azureData: { accountId: nonNullProp(server, 'id'), accountName: nonNullProp(server, 'name'), resourceGroup: azureUtils.azureUtils.getResourceGroupFromId(nonNullProp(server, 'id')), accountKind: API.PostgresSingle }, postgresData: { serverType: nonNullProp(server, 'serverType') } }));
            } else {
                const postgresFlexibleClient = await createPostgreSQLFlexibleClient(wizardContext);
                const postgresFlexibleServers = [
                    ...(await postgresFlexibleClient.servers.list()).map(s => Object.assign(s, { serverType: PostgresServerType.Flexible })),
                ];
                databaseItems.push(...postgresFlexibleServers.map(server => <DBTreeItem>{ hostName: nonNullProp(server, 'fullyQualifiedDomainName'), port: '5432', azureData: { accountId: nonNullProp(server, 'id'), accountName: nonNullProp(server, 'name'), resourceGroup: azureUtils.azureUtils.getResourceGroupFromId(nonNullProp(server, 'id')), accountKind: API.PostgresFlexible }, postgresData: { serverType: nonNullProp(server, 'serverType') } }));
            }
        } else {
            const postgresSingleClient = await createPostgreSQLClient(wizardContext);
            const postgresSingleServers = [
                ...(await postgresSingleClient.servers.list()).map(s => Object.assign(s, { serverType: PostgresServerType.Single })),
            ];
            databaseItems.push(...postgresSingleServers.map(server => <DBTreeItem>{ hostName: nonNullProp(server, 'fullyQualifiedDomainName'), port: '5432', azureData: { accountId: nonNullProp(server, 'id'), accountName: nonNullProp(server, 'name'), resourceGroup: azureUtils.azureUtils.getResourceGroupFromId(nonNullProp(server, 'id')), accountKind: API.PostgresSingle }, postgresData: { serverType: nonNullProp(server, 'serverType') } }));
            const postgresFlexibleClient = await createPostgreSQLFlexibleClient(wizardContext);
            const postgresFlexibleServers = [
                ...(await postgresFlexibleClient.servers.list()).map(s => Object.assign(s, { serverType: PostgresServerType.Flexible })),
            ];
            databaseItems.push(...postgresFlexibleServers.map(server => <DBTreeItem>{ hostName: nonNullProp(server, 'fullyQualifiedDomainName'), port: '5432', azureData: { accountId: nonNullProp(server, 'id'), accountName: nonNullProp(server, 'name'), resourceGroup: azureUtils.azureUtils.getResourceGroupFromId(nonNullProp(server, 'id')), accountKind: API.PostgresFlexible }, postgresData: { serverType: nonNullProp(server, 'serverType') } }));
        }


        return databaseItems;
    }

    public static async getCosmosDatabases(wizardContext: IConnectDBWizardContext, api?: API): Promise<DBTreeItem[]> {

        const cosmosClient = await createCosmosDBClient(wizardContext);
        const cosmosAccounts: DatabaseAccountsListResult = (await cosmosClient.databaseAccounts.list())._response.parsedBody;
        let databaseTreeItems: DBTreeItem[] = [];
        for (const account of cosmosAccounts) {
            const experience = tryGetExperience(account);
            const accountName = nonNullProp(account, 'name');
            const accountId = nonNullProp(account, 'id');
            const result = (await cosmosClient.databaseAccounts.listConnectionStrings(azureUtils.azureUtils.getResourceGroupFromId(accountId), accountName))._response.parsedBody;
            let connectionString: string | undefined;
            if (experience && experience.api === "MongoDB") {
                const connectionStringURL: URL = new URL(nonNullProp(nonNullProp(result, 'connectionStrings')[0], 'connectionString'));
                // for any Mongo connectionString, append this query param because the Cosmos Mongo API v3.6 doesn't support retrywrites
                // but the newer node.js drivers started breaking this
                const searchParam: string = 'retrywrites';
                if (!connectionStringURL.searchParams.has(searchParam)) {
                    connectionStringURL.searchParams.set(searchParam, 'false');
                }
                connectionString = connectionStringURL.toString();
                const databaseItem: DBTreeItem = { hostName: accountName, port: '5432', connectionString, azureData: { accountId: accountId, accountName: accountName, resourceGroup: azureUtils.azureUtils.getResourceGroupFromId(accountId), accountKind: getExperienceLabel(account) } };
                databaseTreeItems.push(databaseItem);

            } else {
                const masterKeyResult = (await cosmosClient.databaseAccounts.listKeys(azureUtils.azureUtils.getResourceGroupFromId(accountId), accountName))._response.parsedBody;

                const endpoint = nonNullProp(account, 'documentEndpoint');
                const masterKey = nonNullProp(masterKeyResult, 'primaryMasterKey');
                const databaseItem: DBTreeItem = { hostName: accountName, port: '5432', connectionString, azureData: { accountId: accountId, accountName: accountName, resourceGroup: azureUtils.azureUtils.getResourceGroupFromId(accountId), accountKind: getExperienceLabel(account) }, docDBData: { masterKey, documentEndpoint: endpoint } };
                databaseTreeItems.push(databaseItem);
            }

        }
        if (api) {
            databaseTreeItems = databaseTreeItems.filter(db => db.azureData?.accountKind?.includes((api === API.Core ? 'SQL' : api)));
        }
        return databaseTreeItems;
    }

    public async prompt(context: IConnectDBWizardContext): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: 'Add Azure Database Connection' };
        const input: IAzureQuickPickItem<DBTreeItem | undefined> = await context.ui.showQuickPick(this.getQuickPickItems(context), options);
        if (input.label === skipForNowLabel) {
            context.addDBConnectionSkip = true;
        } else if (input.label.includes('Create')) {
            context.createDBAccount = true;
        } else if (input.data) {
            context.databaseConnectionTreeItem = input.data;
        }
    }

    public shouldPrompt(context: IConnectDBWizardContext): boolean {
        return !context.databaseAccountName;
    }

    public async getSubWizard(context: IConnectDBWizardContext): Promise<IWizardOptions<IConnectDBWizardContext> | undefined> {
        if (context.createDBAccount) {
            const promptSteps: AzureWizardPromptStep<ILocationWizardContext>[] = [new AzureDBAPIStep(), new ResourceGroupListStep()];

            LocationListStep.addStep(context, promptSteps);
            return {
                promptSteps: promptSteps,
                executeSteps: []
            }
        }
        return undefined;
    }

    private async getQuickPickItems(context: IConnectDBWizardContext): Promise<IAzureQuickPickItem<DBTreeItem | undefined>[]> {
        const picks: IAzureQuickPickItem<DBTreeItem | undefined>[] = !this._suppressCreate ? [{
            label: localize('newDBConnection', '$(plus) Create new Azure Database Account'),
            data: undefined
        }] : [];
        if (!this._suppressSkip) {
            picks.push({
                label: localize('skipForNow', skipForNowLabel),
                data: undefined
            });
        }

        const components: DBTreeItem[] = [];
        if (context.defaultExperience) {
            const api: API = context.defaultExperience.api;
            switch (api) {
                case API.Core:
                    components.push(...await ConnectDatabaseAccountPromptStep.getCosmosDatabases(context, api));
                    break;
                case API.MongoDB:
                    components.push(...await ConnectDatabaseAccountPromptStep.getCosmosDatabases(context, api));
                    break;
                case API.PostgresSingle:
                    components.push(...await ConnectDatabaseAccountPromptStep.getPostgresDatabases(context, api));
                    break;
                default:
                    components.push(...await ConnectDatabaseAccountPromptStep.getPostgresDatabases(context, api));
                    break;
            }
        } else {
            components.push(...await ConnectDatabaseAccountPromptStep.getPostgresDatabases(context));
            components.push(...await ConnectDatabaseAccountPromptStep.getCosmosDatabases(context));

            const items: IAzureQuickPickItem<DBTreeItem>[] = components.map((c: DBTreeItem) => {
                const item: IAzureQuickPickItem<DBTreeItem> = {
                    label: `${c.azureData?.accountName} (${c.azureData?.accountKind})`,
                    data: c
                };
                return item;
            });

            picks.push(...items);

        }

        const items: IAzureQuickPickItem<DBTreeItem>[] = components.map((c: DBTreeItem) => {
            const item: IAzureQuickPickItem<DBTreeItem> = {
                label: `${c.azureData?.accountName} (${c.azureData?.accountKind})`,
                data: c
            };
            return item;
        });

        picks.push(...items);

        return picks;
    }

}
