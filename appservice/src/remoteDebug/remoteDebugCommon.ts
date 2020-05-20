/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';

export function reportMessage(message: string, progress: vscode.Progress<{}>, token: vscode.CancellationToken): void {
    if (token.isCancellationRequested) {
        throw new UserCancelledError();
    }

    ext.outputChannel.appendLog(message);
    progress.report({ message: message });
}

export async function setRemoteDebug(isRemoteDebuggingToBeEnabled: boolean, confirmMessage: string, noopMessage: string | undefined, siteClient: SiteClient, siteConfig: SiteConfigResource, progress: vscode.Progress<{}>, token: vscode.CancellationToken, learnMoreLink?: string): Promise<void> {
    const state: string | undefined = await siteClient.getState();
    if (state && state.toLowerCase() === 'stopped') {
        throw new Error(localize('remoteDebugStopped', 'The app must be running, but is currently in state "Stopped". Start the app to continue.'));
    }

    if (isRemoteDebuggingToBeEnabled !== siteConfig.remoteDebuggingEnabled) {
        const confirmButton: vscode.MessageItem = isRemoteDebuggingToBeEnabled ? { title: 'Enable' } : { title: 'Disable' };

        // don't have to check input as this handles cancels and learnMore responses
        await ext.ui.showWarningMessage(confirmMessage, { modal: true, learnMoreLink }, confirmButton);
        siteConfig.remoteDebuggingEnabled = isRemoteDebuggingToBeEnabled;
        reportMessage(localize('remoteDebugUpdate', 'Updating site configuration to set remote debugging...'), progress, token);

        await callWithTelemetryAndErrorHandling('appService.remoteDebugUpdateConfiguration', async (context: IActionContext) => {
            context.errorHandling.suppressDisplay = true;
            context.errorHandling.rethrow = true;
            await siteClient.updateConfiguration(siteConfig);
        });

        reportMessage(localize('remoteDebugUpdateDone', 'Updating site configuration done.'), progress, token);
    } else {
        // Update not needed
        if (noopMessage) {
            vscode.window.showWarningMessage(noopMessage);
        }
    }
}
