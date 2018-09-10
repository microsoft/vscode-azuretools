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
    const logStreamId: string = getLogStreamId(client, logsPath);
    const logStream: ILogStream | undefined = logStreams.get(logStreamId);

    if (logStream && logStream.isConnected) {
        logStream.outputChannel.show();
        await ext.ui.showWarningMessage(localize('logStreamAlreadyActive', 'The log-streaming service for "{0}" is already active.', logStreamLabel));
        return logStream;
    } else {
        await verifyLoggingEnabled();

        const outputChannel: vscode.OutputChannel = logStream ? logStream.outputChannel : vscode.window.createOutputChannel(localize('logStreamLabel', '{0} - Log Stream', logStreamLabel));
        ext.context.subscriptions.push(outputChannel);

        const kuduClient: KuduClient = await getKuduClient(client);

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
                    let newLogStream: ILogStream;
                    const logsRequest: request.Request = requestApi(`${client.kuduUrl}/api/logstream/${logsPath}`);
                    newLogStream = {
                        dispose: (): void => {
                            logsRequest.removeAllListeners();
                            logsRequest.destroy();
                            outputChannel.show();
                            if (timerId) {
                                clearInterval(timerId);
                            }
                            outputChannel.appendLine(localize('logStreamDisconnected', 'Disconnected from log-streaming service.'));
                            newLogStream.isConnected = false;
                            onLogStreamEnded();
                        },
                        isConnected: true,
                        outputChannel: outputChannel
                    };

                    logsRequest.on('data', (chunk: Buffer | string) => {
                        outputChannel.appendLine(chunk.toString());
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
