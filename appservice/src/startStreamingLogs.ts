/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbortController } from '@azure/abort-controller';
import { WebSiteManagementModels } from '@azure/arm-appservice';
import { Request, default as fetch } from 'node-fetch';
import { setInterval } from 'timers';
import * as vscode from 'vscode';
import { appendExtensionUserAgent, callWithTelemetryAndErrorHandling, IActionContext, parseError } from 'vscode-azureextensionui';
import { ext } from './extensionVariables';
import { ISimplifiedSiteClient } from './ISimplifiedSiteClient';
import { localize } from './localize';
import { pingFunctionApp } from './pingFunctionApp';
import { nonNullProp } from './utils/nonNull';

export interface ILogStream extends vscode.Disposable {
    isConnected: boolean;
    outputChannel: vscode.OutputChannel;
}

const logStreams: Map<string, ILogStream> = new Map<string, ILogStream>();

function getLogStreamId(client: ISimplifiedSiteClient, logsPath: string): string {
    return `${client.id}${logsPath}`;
}

export async function startStreamingLogs(client: ISimplifiedSiteClient, verifyLoggingEnabled: () => Promise<void>, logStreamLabel: string, logsPath: string = ''): Promise<ILogStream> {
    const logStreamId: string = getLogStreamId(client, logsPath);
    const logStream: ILogStream | undefined = logStreams.get(logStreamId);
    if (logStream && logStream.isConnected) {
        logStream.outputChannel.show();
        void ext.ui.showWarningMessage(localize('logStreamAlreadyActive', 'The log-streaming service for "{0}" is already active.', logStreamLabel));
        return logStream;
    } else {
        await verifyLoggingEnabled();

        const outputChannel: vscode.OutputChannel = logStream ? logStream.outputChannel : vscode.window.createOutputChannel(localize('logStreamLabel', '{0} - Log Stream', logStreamLabel));
        ext.context.subscriptions.push(outputChannel);
        outputChannel.show();
        outputChannel.appendLine(localize('connectingToLogStream', 'Connecting to log stream...'));

        const creds: WebSiteManagementModels.User = await client.getWebAppPublishCredential();

        return await new Promise((onLogStreamCreated: (ls: ILogStream) => void): void => {
            // Intentionally setting up a separate telemetry event and not awaiting the result here since log stream is a long-running action
            void callWithTelemetryAndErrorHandling('appService.streamingLogs', async (context: IActionContext) => {
                context.errorHandling.suppressDisplay = true;
                let timerId: NodeJS.Timer | undefined;
                if (client.isFunctionApp) {
                    // For Function Apps, we have to ping "/admin/host/status" every minute for logging to work
                    // https://github.com/Microsoft/vscode-azurefunctions/issues/227
                    await pingFunctionApp(client);
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    timerId = setInterval(async () => await pingFunctionApp(client), 60 * 1000);
                }

                const buffer = Buffer.from(`${creds.publishingUserName}${nonNullProp(creds, 'publishingPassword')}`);
                const abortController = new AbortController();

                const logsRequest = new Request(`${client.kuduUrl}/api/logstream/${logsPath}`, {
                    headers: {
                        Authorization: `Basic ${buffer.toString('base64')}`,
                        'User-Agent': appendExtensionUserAgent(),
                    },
                    signal: abortController.signal,
                });

                const logsResponse = await fetch(logsRequest);

                await new Promise<void>((onLogStreamEnded: () => void, reject: (err: Error) => void): void => {
                    const newLogStream: ILogStream = {
                        dispose: (): void => {
                            logsResponse.body.removeAllListeners();
                            abortController.abort();
                            outputChannel.show();
                            if (timerId) {
                                clearInterval(timerId);
                            }
                            outputChannel.appendLine(localize('logStreamDisconnected', 'Disconnected from log-streaming service.'));
                            newLogStream.isConnected = false;
                            void onLogStreamEnded();
                        },
                        isConnected: true,
                        outputChannel: outputChannel
                    };

                    logsResponse.body.on('data', (chunk: Buffer | string) => {
                        outputChannel.append(chunk.toString());
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

export async function stopStreamingLogs(client: ISimplifiedSiteClient, logsPath: string = ''): Promise<void> {
    const logStreamId: string = getLogStreamId(client, logsPath);
    const logStream: ILogStream | undefined = logStreams.get(logStreamId);
    if (logStream && logStream.isConnected) {
        logStream.dispose();
    } else {
        await vscode.window.showWarningMessage(localize('alreadyDisconnected', 'The log-streaming service is already disconnected.'));
    }
}
