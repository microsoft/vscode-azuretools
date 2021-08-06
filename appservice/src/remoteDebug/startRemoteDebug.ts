/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { ParsedSite } from '../SiteClient';
import { TunnelProxy } from '../TunnelProxy';
import { reportMessage, setRemoteDebug } from './remoteDebugCommon';

const remoteDebugLink: string = 'https://aka.ms/appsvc-remotedebug';

let isRemoteDebugging: boolean = false;

export enum RemoteDebugLanguage {
    Node,
    Python
}

export async function startRemoteDebug(context: IActionContext, site: ParsedSite, siteConfig: WebSiteManagementModels.SiteConfigResource, language: RemoteDebugLanguage): Promise<void> {
    if (isRemoteDebugging) {
        throw new Error(localize('remoteDebugAlreadyStarted', 'Azure Remote Debugging is currently starting or already started.'));
    }

    isRemoteDebugging = true;
    try {
        await startRemoteDebugInternal(context, site, siteConfig, language);
    } catch (error) {
        isRemoteDebugging = false;
        throw error;
    }
}

async function startRemoteDebugInternal(context: IActionContext, site: ParsedSite, siteConfig: WebSiteManagementModels.SiteConfigResource, language: RemoteDebugLanguage): Promise<void> {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, token): Promise<void> => {
        const debugConfig: vscode.DebugConfiguration = await getDebugConfiguration(context, language);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const localHostPortNumber: number = debugConfig.port;

        const confirmEnableMessage: string = localize('remoteDebugEnablePrompt', 'The configuration will be updated to enable remote debugging. Would you like to continue? This will restart the app.');
        await setRemoteDebug(context, true, confirmEnableMessage, undefined, site, siteConfig, progress, token, remoteDebugLink);

        reportMessage(localize('remoteDebugStartingTunnel', 'Starting tunnel proxy...'), progress, token);

        const client = await site.createClient(context);
        const publishCredential: WebSiteManagementModels.User = await client.getWebAppPublishCredential();
        const tunnelProxy: TunnelProxy = new TunnelProxy(localHostPortNumber, site, publishCredential);
        await callWithTelemetryAndErrorHandling('appService.remoteDebugStartProxy', async (startContext: IActionContext) => {
            startContext.errorHandling.suppressDisplay = true;
            startContext.errorHandling.rethrow = true;
            await tunnelProxy.startProxy(context, token);
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
                    await setRemoteDebug(context, false, confirmDisableMessage, undefined, site, siteConfig, innerProgress, innerToken, remoteDebugLink);
                });
            }
        });
    });
}

function getNodeDebugConfiguration(context: IActionContext, sessionId: string, portNumber: number, host: string): vscode.DebugConfiguration {
    const config: vscode.DebugConfiguration = {
        name: sessionId,
        type: 'node',
        protocol: 'inspector',
        remoteRoot: '/home/site/wwwroot',
        request: 'attach',
        address: host,
        port: portNumber,
    }

    // Try to map workspace folder source files to the remote instance
    if (vscode.workspace.workspaceFolders) {
        if (vscode.workspace.workspaceFolders.length === 1) {
            config.localRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else {
            // In this case we don't know which folder to use. Show a warning and proceed.
            // In the future we should allow users to choose a workspace folder to map sources from.
            void context.ui.showWarningMessage(localize('remoteDebugMultipleFolders', 'Unable to bind breakpoints from workspace when multiple folders are open. Use "loaded scripts" instead.'));
        }
    } else {
        // vscode will throw an error if you try to start debugging without any workspace folder open
        throw new Error(localize('remoteDebugNoFolders', 'Please open a workspace folder before attaching a debugger.'));
    }

    return config;
}

function getPythonDebugConfiguration(sessionId: string, portNumber: number, host: string): vscode.DebugConfiguration {
    const config: vscode.DebugConfiguration = {
        name: sessionId,
        type: 'python',
        request: 'attach',
        connect: {
            host: host,
            port: portNumber,
        },
        pathMappings: [
            {
                localRoot: '${workspaceFolder}',
                remoteRoot: '.',
            },
        ],
    };

    return config;
}

async function getDebugConfiguration(context: IActionContext, language: RemoteDebugLanguage): Promise<vscode.DebugConfiguration> {
    const sessionId: string = Date.now().toString();
    const portNumber: number = await portfinder.getPortPromise();
    const host: string = 'localhost';

    switch (language){
        case RemoteDebugLanguage.Node:
            return getNodeDebugConfiguration(context, sessionId, portNumber, host);
        case RemoteDebugLanguage.Python:
            return getPythonDebugConfiguration(sessionId, portNumber, host);
        default:
            throw new Error(localize('remoteDebugLanguageNotSupported', 'The language "{0}" is not supported for remote debugging.', language));
    }
}
