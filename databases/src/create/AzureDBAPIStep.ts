/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VerifyProvidersStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep, AzureWizardPromptStep, IAzureQuickPickItem, IWizardOptions } from '@microsoft/vscode-azext-utils';
import { API, Experience, getExperienceQuickPicks } from './AzureDBExperiences';
import { CosmosDBAccountCapacityStep } from './CosmosDBAccountWizard/CosmosDBAccountCapacityStep';
import { CosmosDBAccountCreateStep } from './CosmosDBAccountWizard/CosmosDBAccountCreateStep';
import { CosmosDBAccountNameStep } from './CosmosDBAccountWizard/CosmosDBAccountNameStep';
import { ICosmosDBWizardContext } from './CosmosDBAccountWizard/ICosmosDBWizardContext';
import { IAzureDBWizardContext } from './IAzureDBWizardContext';
import { PostgresServerType } from './PostgresAccountWizard/abstract/models';
import { PostgresServerConfirmPWStep } from './PostgresAccountWizard/createPostgresServer/PostgresServerConfirmPWStep';
import { PostgresServerCreateStep } from './PostgresAccountWizard/createPostgresServer/PostgresServerCreateStep';
import { PostgresServerCredPWStep } from './PostgresAccountWizard/createPostgresServer/PostgresServerCredPWStep';
import { PostgresServerCredUserStep } from './PostgresAccountWizard/createPostgresServer/PostgresServerCredUserStep';
import { PostgresServerNameStep } from './PostgresAccountWizard/createPostgresServer/PostgresServerNameStep';
import { PostgresServerSkuStep } from './PostgresAccountWizard/createPostgresServer/PostgresServerSkuStep';
import { IPostgresServerWizardContext } from './PostgresAccountWizard/IPostgresServerWizardContext';
import { localize } from '../utils/localize';

export class AzureDBAPIStep extends AzureWizardPromptStep<IPostgresServerWizardContext | ICosmosDBWizardContext> {
    public async prompt(context: IAzureDBWizardContext): Promise<void> {
        const picks: IAzureQuickPickItem<Experience>[] = getExperienceQuickPicks();

        const result: IAzureQuickPickItem<Experience> = await context.ui.showQuickPick(picks, {
            placeHolder: localize('selectDBServerMsg', 'Select an Azure Database Server.')
        });

        context.defaultExperience = result.data;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getSubWizard(context: IAzureDBWizardContext): Promise<IWizardOptions<IPostgresServerWizardContext | ICosmosDBWizardContext>> {
        let promptSteps: AzureWizardPromptStep<IPostgresServerWizardContext | ICosmosDBWizardContext>[];
        let executeSteps: AzureWizardExecuteStep<IPostgresServerWizardContext | ICosmosDBWizardContext>[];
        if (context.defaultExperience?.api === API.PostgresSingle || context.defaultExperience?.api === API.PostgresFlexible) {
            switch (context.defaultExperience?.api) {
                case API.PostgresFlexible:
                    (context as IPostgresServerWizardContext).serverType = PostgresServerType.Flexible;
                    break;
                case API.PostgresSingle:
                    (context as IPostgresServerWizardContext).serverType = PostgresServerType.Single;
                    break;
            }
            promptSteps = [
                new PostgresServerNameStep(),
                new PostgresServerSkuStep(),
                new PostgresServerCredUserStep(),
                new PostgresServerCredPWStep(),
                new PostgresServerConfirmPWStep(),
            ];
            executeSteps = [
                new PostgresServerCreateStep(),
                new VerifyProvidersStep(['Microsoft.DBforPostgreSQL'])
            ];
        } else {
            promptSteps = [
                new CosmosDBAccountNameStep(),
                new CosmosDBAccountCapacityStep(),
            ];
            executeSteps = [
                new CosmosDBAccountCreateStep(),
                new VerifyProvidersStep(['Microsoft.DocumentDB'])
            ];
        }
        return { promptSteps, executeSteps };
    }

    public shouldPrompt(context: IAzureDBWizardContext): boolean {
        return !context.defaultExperience;
    }
}
