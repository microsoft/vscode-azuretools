/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { IActionContext, ISubscriptionWizardContext } from 'vscode-azureextensionui';
import { AppKind } from './AppKind';
import { createAppService } from './createAppService';
import { IAppCreateOptions } from './IAppCreateOptions';

export async function createFunctionApp(
    actionContext: IActionContext,
    subscriptionContext: ISubscriptionWizardContext,
    createOptions?: IAppCreateOptions,
    showCreatingNode?: (label: string) => void): Promise<Site> {
    return await createAppService(AppKind.functionapp, actionContext, subscriptionContext, createOptions, showCreatingNode);
}
