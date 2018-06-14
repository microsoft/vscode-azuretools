/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel } from 'vscode';
import { IActionContext, IAzureUserInput } from 'vscode-azureextensionui';
import { AppKind } from './AppKind';
import { createAppService } from './createAppService';

export async function createWebApp(
    outputChannel: OutputChannel,
    ui: IAzureUserInput,
    actionContext: IActionContext,
    credentials: ServiceClientCredentials,
    subscriptionId: string,
    subscriptionDisplayName: string,
    showCreatingNode?: (label: string) => void,
    fsPath?: string,
    streamlinedSteps?: boolean): Promise<Site> {
    return await createAppService(AppKind.app, undefined, outputChannel, ui, actionContext, credentials, subscriptionId, subscriptionDisplayName, showCreatingNode, fsPath, streamlinedSteps);
}
