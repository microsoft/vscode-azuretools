/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel } from 'vscode';
import { IActionContext, IAzureUserInput } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
import { createAppService } from './createAppService';

export async function createWebApp(outputChannel: OutputChannel, ui: IAzureUserInput, actionContext: IActionContext, credentials: ServiceClientCredentials, subscription: Subscription, showCreatingNode?: (label: string) => void): Promise<Site | undefined> {
    return await createAppService(AppKind.app, WebsiteOS.linux, outputChannel, ui, actionContext, credentials, subscription, showCreatingNode);
}
