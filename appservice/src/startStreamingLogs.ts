/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebResource } from 'ms-rest';
import * as request from 'request';
import { setInterval } from 'timers';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext, parseError } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { ext } from './extensionVariables';
import { getKuduClient } from './getKuduClient';
import { localize } from './localize';
import { pingFunctionApp } from './pingFunctionApp';
import { signRequest } from './signRequest';
import { SiteClient } from './SiteClient';

export interface ILogStream extends vscode.Disposable {
    isConnected: boolean;
    outputChannel: vscode.OutputChannel;
}

const logStreams: Map<string, ILogStream> = new Map();

function getLogStreamId(client: SiteClient, logsPath: string): string {
    return `${client.id}${logsPath}`;
}

export async function startStreamingLogs(client: SiteClient, verifyLoggingEnabled: () => Promise<void>, logStreamLabel: string, logsPath: string = ''): Promise<ILogStream> {
    const kuduClient: KuduClient = await getKuduClient(client);
    const logStreamId: string = getLogStreamId(client, logsPath);
    const logStream: ILogStream | undefined = logStreams.get(logStreamId);
    if (logStream && logStream.isConnected) {
        logStream.outputChannel.show();
        // tslint:disable-next-line:no-floating-promises
        ext.ui.showWarningMessage(localize('logStreamAlreadyActive', 'The log-streaming service for "{0}" is already active.', logStreamLabel));
        return logStream;
    } else {
        await verifyLoggingEnabled();

        const outputChannel: vscode.OutputChannel = logStream ? logStream.outputChannel : vscode.window.createOutputChannel(localize('logStreamLabel', '{0} - Log Stream', logStreamLabel));
        ext.context.subscriptions.push(outputChannel);
        outputChannel.show();
        outputChannel.appendLine(localize('connectingToLogStream', 'Connecting to log stream...'));
        const httpRequest: WebResource = new WebResource();
        await signRequest(httpRequest, kuduClient.credentials);

        const requestApi: request.RequestAPI<request.Request, request.CoreOptions, {}> = request.defaults(httpRequest);
        return await new Promise((onLogStreamCreated: (ls: ILogStream) => void): void => {
            // Intentionally setting up a separate telemetry event and not awaiting the result here since log stream is a long-running action
            // tslint:disable-next-line:no-floating-promises
            callWithTelemetryAndErrorHandling('appService.streamingLogs', async function (this: IActionContext): Promise<void> {
                this.suppressErrorDisplay = true;
                let timerId: NodeJS.Timer | undefined;
                if (client.isFunctionApp) {
                    // For Function Apps, we have to ping "/admin/host/status" every minute for logging to work
                    // https://github.com/Microsoft/vscode-azurefunctions/issues/227
                    await pingFunctionApp(client);
                    timerId = setInterval(async () => await pingFunctionApp(client), 60 * 1000);
                }

                await new Promise((onLogStreamEnded: () => void, reject: (err: Error) => void): void => {
                    let recentData: string = '';
                    let newLogStream: ILogStream;
                    const logsRequest: request.Request = requestApi(`${client.kuduUrl}/api/logstream/${logsPath}`);
                    const recentDataTimer: NodeJS.Timer = setInterval(() => { recentData = ''; }, 2 * 1000);
                    newLogStream = {
                        dispose: (): void => {
                            logsRequest.removeAllListeners();
                            logsRequest.destroy();
                            outputChannel.show();
                            if (timerId) {
                                clearInterval(timerId);
                            }
                            clearInterval(recentDataTimer);
                            outputChannel.appendLine(localize('logStreamDisconnected', 'Disconnected from log-streaming service.'));
                            newLogStream.isConnected = false;
                            onLogStreamEnded();
                        },
                        isConnected: true,
                        outputChannel: outputChannel
                    };

                    logsRequest.on('data', (data: Buffer | string) => {
                        data = data.toString();
                        // Check if this is duplicate output due to https://github.com/Microsoft/vscode-azurefunctions/issues/1089
                        if (!recentData.includes(data)) {
                            outputChannel.append(data);
                            recentData += data;
                        }
                    }).on('error', (err: Error) => {
                        if (timerId) {
                            clearInterval(timerId);
                        }
                        newLogStream.isConnected = false;
                        outputChannel.show();
                        outputChannel.appendLine(localize('logStreamError', 'Error connecting to log-streaming service:'));
                        outputChannel.appendLine(parseError(err).message);
                        reject(err);
                    }).on('complete', () => {
                        newLogStream.dispose();
                    });

                    logStreams.set(logStreamId, newLogStream);
                    onLogStreamCreated(newLogStream);
                });
            });
        });
    }
}

export async function stopStreamingLogs(client: SiteClient, logsPath: string = ''): Promise<void> {
    const logStreamId: string = getLogStreamId(client, logsPath);
    const logStream: ILogStream | undefined = logStreams.get(logStreamId);
    if (logStream && logStream.isConnected) {
        logStream.dispose();
    } else {
        await vscode.window.showWarningMessage(localize('alreadyDisconnected', 'The log-streaming service is already disconnected.'));
    }
}
