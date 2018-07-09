/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { IActionContext } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
import { createAppService } from './createAppService';

export async function createFunctionApp(
    actionContext: IActionContext,
    credentials: ServiceClientCredentials,
    subscriptionId: string,
    subscriptionDisplayName: string,
    showCreatingNode: (label: string) => void,
    appSettings: { [key: string]: string }): Promise<Site> {
    return await createAppService(AppKind.functionapp, WebsiteOS.windows, actionContext, credentials, subscriptionId, subscriptionDisplayName, showCreatingNode, true, appSettings);
}
