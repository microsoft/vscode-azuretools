/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan } from '@azure/arm-appservice';
import { AzureWizard, ExecuteActivityContext } from '@microsoft/vscode-azext-utils';
import { l10n } from 'vscode';
import { ParsedSite } from '../SiteClient';
import { IDeployContext, InnerDeployContext } from './IDeployContext';
import { createDeployExecuteSteps } from './wizard/createDeployWizard';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.showOutputChannel'` that should be registered by each extension
 */
export async function deploy(site: ParsedSite, fsPath: string, context: IDeployContext & ExecuteActivityContext): Promise<void> {
    const client = await site.createClient(context);
    const aspPromise: Promise<AppServicePlan | undefined> = client.getAppServicePlan();

    const innerContext: InnerDeployContext = Object.assign(context, { site, fsPath, client, aspPromise });
    const title: string = l10n.t('Deploying to function app "{0}"', site.fullName);
    const executeSteps = await createDeployExecuteSteps(innerContext);
    const wizard: AzureWizard<InnerDeployContext> = new AzureWizard<InnerDeployContext>(innerContext, { executeSteps, title });
    innerContext.activityTitle = title;
    await wizard.execute();
}
