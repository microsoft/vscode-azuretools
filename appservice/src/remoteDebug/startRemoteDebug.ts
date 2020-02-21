/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource, User } from 'azure-arm-website/lib/models';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { TunnelProxy } from '../TunnelProxy';
import { reportMessage, setRemoteDebug } from './remoteDebugCommon';

const remoteDebugLink: string = 'https://aka.ms/appsvc-remotedebug';

let isRemoteDebugging: boolean = false;

export enum RemoteDebugLanguage {
    Node,
    Python
}

export async function startRemoteDebug(siteClient: SiteClient, siteConfig: SiteConfigResource, language: RemoteDebugLanguage): Promise<void> {
    if (isRemoteDebugging) {
        throw new Error(localize('remoteDebugAlreadyStarted', 'Azure Remote Debugging is currently starting or already started.'));
    }

    isRemoteDebugging = true;
    try {
        await startRemoteDebugInternal(siteClient, siteConfig, language);
    } catch (error) {
        isRemoteDebugging = false;
        throw error;
    }
}

async function startRemoteDebugInternal(siteClient: SiteClient, siteConfig: SiteConfigResource, language: RemoteDebugLanguage): Promise<void> {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, token): Promise<void> => {
        const debugConfig: vscode.DebugConfiguration = await getDebugConfiguration(language);
        // tslint:disable-next-line:no-unsafe-any
        const localHostPortNumber: number = debugConfig.port;

        const confirmEnableMessage: string = localize('remoteDebugEnablePrompt', 'The configuration will be updated to enable remote debugging. Would you like to continue? This will restart the app.');
        await setRemoteDebug(true, confirmEnableMessage, undefined, siteClient, siteConfig, progress, token, remoteDebugLink);

        reportMessage(localize('remoteDebugStartingTunnel', 'Starting tunnel proxy...'), progress, token);

        const publishCredential: User = await siteClient.getWebAppPublishCredential();
        const tunnelProxy: TunnelProxy = new TunnelProxy(localHostPortNumber, siteClient, publishCredential);
        await callWithTelemetryAndErrorHandling('appService.remoteDebugStartProxy', async (startContext: IActionContext) => {
            startContext.errorHandling.suppressDisplay = true;
            startContext.errorHandling.rethrow = true;
            await tunnelProxy.startProxy(token);
        });

        reportMessage(localize('remoteDebugAttaching', 'Attaching debugger...'), progress, token);

        await callWithTelemetryAndErrorHandling('appService.remoteDebugAttach', async (attachContext: IActionContext) => {
            attachContext.errorHandling.suppressDisplay = true;
            attachContext.errorHandling.rethrow = true;
            await vscode.debug.startDebugging(undefined, debugConfig);
        });

        reportMessage(localize('remoteDebugAttached', 'Attached!'), progress, token);

        const terminateDebugListener: vscode.Disposable = vscode.debug.onDidTerminateDebugSession(async (event: vscode.DebugSession) => {
            if (event.name === debugConfig.name) {
                isRemoteDebugging = false;

                if (tunnelProxy !== undefined) {
                    tunnelProxy.dispose();
                }
                terminateDebugListener.dispose();

                const confirmDisableMessage: string = localize('remoteDebugDisablePrompt', 'Remaining in debugging mode may cause performance issues. Would you like to disable debugging? This will restart the app.');
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (innerProgress, innerToken): Promise<void> => {
                    await setRemoteDebug(false, confirmDisableMessage, undefined, siteClient, siteConfig, innerProgress, innerToken, remoteDebugLink);
                });
            }
        });
    });
}

const baseConfigs: { [key in RemoteDebugLanguage]: Object } = {
    [RemoteDebugLanguage.Node]: {
        type: 'node',
        protocol: 'inspector'
    },
    [RemoteDebugLanguage.Python]: {
        type: 'python'
    }
};

async function getDebugConfiguration(language: RemoteDebugLanguage): Promise<vscode.DebugConfiguration> {
    if (!(language in baseConfigs)) {
        throw new Error(localize('remoteDebugLanguageNotSupported', 'The language "{0}" is not supported for remote debugging.', language));
    }

    const sessionId: string = Date.now().toString();
    const portNumber: number = await portfinder.getPortPromise();

    const config: vscode.DebugConfiguration = <vscode.DebugConfiguration>baseConfigs[language];
    config.name = sessionId;
    config.request = 'attach';
    config.address = 'localhost';
    config.port = portNumber;

    // Try to map workspace folder source files to the remote instance
    if (vscode.workspace.workspaceFolders) {
        if (vscode.workspace.workspaceFolders.length === 1) {
            config.localRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            config.remoteRoot = '/home/site/wwwroot';
        } else {
            // In this case we don't know which folder to use. Show a warning and proceed.
            // In the future we should allow users to choose a workspace folder to map sources from.
            // tslint:disable-next-line:no-floating-promises
            ext.ui.showWarningMessage(localize('remoteDebugMultipleFolders', 'Unable to bind breakpoints from workspace when multiple folders are open. Use "loaded scripts" instead.'));
        }
    } else {
        // vscode will throw an error if you try to start debugging without any workspace folder open
        throw new Error(localize('remoteDebugNoFolders', 'Please open a workspace folder before attaching a debugger.'));
    }

    return config;
}
