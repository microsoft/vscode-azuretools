/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import { IConnectDBWizardContext } from '..';
import { API, Experience, getExperienceQuickPicks } from '../create/AzureDBExperiences';
import { localize } from '../utils/localize';

export class DatabaseApiStep extends AzureWizardPromptStep<IConnectDBWizardContext> {
    public async prompt(context: IConnectDBWizardContext): Promise<void> {
        const apiList = [API.Core, API.PostgresSingle, API.PostgresFlexible, API.MongoDB];
        const picks: IAzureQuickPickItem<Experience>[] = getExperienceQuickPicks().filter(pick => apiList.includes(pick.data.api));

        const result: IAzureQuickPickItem<Experience> = await context.ui.showQuickPick(picks, {
            placeHolder: localize('selectDBServerMsg', 'Select an Azure Database Type.')
        });

        context.defaultExperience = result.data;
    }

    public shouldPrompt(context: IConnectDBWizardContext): boolean {
        return !context.defaultExperience;
    }
}
