/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ParsedSite } from '../SiteClient';

export function reportMessage(message: string, progress: vscode.Progress<{}>, token: vscode.CancellationToken): void {
    if (token.isCancellationRequested) {
        throw new UserCancelledError('remoteDebugReportMessage');
    }

    ext.outputChannel.appendLog(message);
    progress.report({ message: message });
}

export async function setRemoteDebug(context: IActionContext, isRemoteDebuggingToBeEnabled: boolean, confirmMessage: string, noopMessage: string | undefined, site: ParsedSite, siteConfig: WebSiteManagementModels.SiteConfigResource, progress: vscode.Progress<{}>, token: vscode.CancellationToken, learnMoreLink?: string): Promise<void> {
    const client = await site.createClient(context);
    const state: string | undefined = await client.getState();
    if (state && state.toLowerCase() === 'stopped') {
        throw new Error(localize('remoteDebugStopped', 'The app must be running, but is currently in state "Stopped". Start the app to continue.'));
    }

    if (isRemoteDebuggingToBeEnabled !== siteConfig.remoteDebuggingEnabled) {
        const confirmButton: vscode.MessageItem = isRemoteDebuggingToBeEnabled ? { title: 'Enable' } : { title: 'Disable' };

        // don't have to check input as this handles cancels and learnMore responses
        await context.ui.showWarningMessage(confirmMessage, { modal: true, learnMoreLink }, confirmButton);
        siteConfig.remoteDebuggingEnabled = isRemoteDebuggingToBeEnabled;
        reportMessage(localize('remoteDebugUpdate', 'Updating site configuration to set remote debugging...'), progress, token);

        await callWithTelemetryAndErrorHandling('appService.remoteDebugUpdateConfiguration', async (updateContext: IActionContext) => {
            updateContext.errorHandling.suppressDisplay = true;
            updateContext.errorHandling.rethrow = true;
            await client.updateConfiguration(siteConfig);
        });

        reportMessage(localize('remoteDebugUpdateDone', 'Updating site configuration done.'), progress, token);
    } else {
        // Update not needed
        if (noopMessage) {
            void vscode.window.showWarningMessage(noopMessage);
        }
    }
}
