/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DatabaseAccountCreateUpdateParameters, DatabaseAccountsCreateOrUpdateResponse } from '@azure/arm-cosmosdb/src/models';
import { LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep, nonNullProp } from '@microsoft/vscode-azext-utils';
import { Progress } from 'vscode';
import { IConnectDBWizardContext } from '../../connect/IConnectDBWizardContext';
import { SERVERLESS_CAPABILITY_NAME } from '../../constants';
import { ext } from '../../extensionVariables';
import { createCosmosDBClient } from '../../utils/azureClients';
import { localize } from '../../utils/localize';
import { ICosmosDBWizardContext } from './ICosmosDBWizardContext';

export class CosmosDBAccountCreateStep extends AzureWizardExecuteStep<IConnectDBWizardContext> {
    public priority: number = 130;

    public async execute(context: IConnectDBWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const locationName: string = (await LocationListStep.getLocation(context)).name;
        const defaultExperience = nonNullProp(context, 'defaultExperience');
        const rgName: string = nonNullProp(nonNullProp(context, 'resourceGroup'), 'name');
        const accountName = nonNullProp(context, 'newServerName');

        const client = await createCosmosDBClient(context);
        const creatingMessage: string = localize('creatingCosmosDBAccount', 'Creating Cosmos DB account "{0}" with the "{1}" API... It should be ready in several minutes.', accountName, defaultExperience.shortName);
        ext.outputChannel.appendLog(creatingMessage);
        progress.report({ message: creatingMessage });

        const options: DatabaseAccountCreateUpdateParameters = {
            databaseAccountOfferType: "Standard",
            location: locationName,
            locations: [{ locationName: locationName }],
            kind: defaultExperience.kind,
            capabilities: [],
            // Note: Setting this tag has no functional effect in the portal, but we'll keep doing it to imitate portal behavior
            tags: { defaultExperience: nonNullProp(defaultExperience, 'tag') },
        };

        if (defaultExperience?.api === 'MongoDB') {
            options.apiProperties = { serverVersion: '3.6' };
        }

        if (defaultExperience.capability) {
            options.capabilities?.push({ name: defaultExperience.capability });
        }

        if (context.isServerless) {
            options.capabilities?.push({ name: SERVERLESS_CAPABILITY_NAME });
        }

        const response: DatabaseAccountsCreateOrUpdateResponse = await client.databaseAccounts.beginCreateOrUpdateAndWait(rgName, accountName, options);
        context.databaseAccount = response;
        ext.outputChannel.appendLog(`Successfully created Cosmos DB account "${accountName}".`);
    }

    public shouldExecute(context: ICosmosDBWizardContext): boolean {
        return !context.databaseAccount;
    }
}
