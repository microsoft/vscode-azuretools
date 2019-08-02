/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from 'azure-arm-appinsights';
import { IAppServiceWizardContext } from 'vscode-azureappservice';
import { AzureWizardExecuteStep, createAzureClient } from 'vscode-azureextensionui';
import { ICreateFuntionAppContext } from '../../tree/SubscriptionTreeItem';
import { nonNullValue } from '../../utils/nonNull';

export class AppInsightsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 500;

    public async execute(context: IAppServiceWizardContext & Partial<ICreateFuntionAppContext>): Promise<void> {
        const client = createAzureClient(context, ApplicationInsightsManagementClient);
        context.applicationInsights = await client.components.createOrUpdate(nonNullValue(context.newResourceGroupName), nonNullValue(context.newSiteName), { kind: 'web', applicationType: 'web', location: 'centralus' });
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return true;
    }
}
