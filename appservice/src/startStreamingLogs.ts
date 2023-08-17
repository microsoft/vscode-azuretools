/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbortController } from '@azure/abort-controller';
import { ServiceClient } from '@azure/core-client';
import { createHttpHeaders, createPipelineRequest } from "@azure/core-rest-pipeline";
import { AzExtPipelineResponse, createGenericClient } from '@microsoft/vscode-azext-azureutils';
import { IActionContext, callWithTelemetryAndErrorHandling, parseError } from '@microsoft/vscode-azext-utils';
import { setInterval } from 'timers';
import * as vscode from 'vscode';
import { ParsedSite } from './SiteClient';
import { ext } from './extensionVariables';
import { pingFunctionApp } from './pingFunctionApp';

export interface ILogStream extends vscode.Disposable {
    isConnected: boolean;
    outputChannel: vscode.OutputChannel;
}

const logStreams: Map<string, ILogStream> = new Map<string, ILogStream>();

function getLogStreamId(site: ParsedSite, logsPath: string): string {
    return `${site.id}${logsPath}`;
}

export async function startStreamingLogs(context: IActionContext, site: ParsedSite, verifyLoggingEnabled: () => Promise<void>, logStreamLabel: string, logsPath: string = ''): Promise<ILogStream> {
    const logStreamId: string = getLogStreamId(site, logsPath);
    const logStream: ILogStream | undefined = logStreams.get(logStreamId);
    if (logStream && logStream.isConnected) {
        logStream.outputChannel.show();
        void context.ui.showWarningMessage(vscode.l10n.t('The log-streaming service for "{0}" is already active.', logStreamLabel));
        return logStream;
    } else {
        await verifyLoggingEnabled();

        const outputChannel: vscode.OutputChannel = logStream ? logStream.outputChannel : vscode.window.createOutputChannel(vscode.l10n.t('{0} - Log Stream', logStreamLabel));
        ext.context.subscriptions.push(outputChannel);
        outputChannel.show();
        outputChannel.appendLine(vscode.l10n.t('Connecting to log stream...'));

        const credentials = site.subscription.credentials;
        const bearerToken = (await credentials.getToken() as { token: string }).token;

        return await new Promise((onLogStreamCreated: (ls: ILogStream) => void): void => {
            // Intentionally setting up a separate telemetry event and not awaiting the result here since log stream is a long-running action
            void callWithTelemetryAndErrorHandling('appService.streamingLogs', async (streamContext: IActionContext) => {
                streamContext.errorHandling.suppressDisplay = true;
                let timerId: NodeJS.Timer | undefined;
                if (site.isFunctionApp) {
                    // For Function Apps, we have to ping "/admin/host/status" every minute for logging to work
                    // https://github.com/Microsoft/vscode-azurefunctions/issues/227
                    await pingFunctionApp(streamContext, site);
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    timerId = setInterval(async () => await pingFunctionApp(streamContext, site), 60 * 1000);
                }

                const genericClient: ServiceClient = await createGenericClient(streamContext, undefined);


                const abortController: AbortController = new AbortController();
                const headers = createHttpHeaders({ Authorization: `Bearer ${bearerToken}` });
                const logsResponse: AzExtPipelineResponse = await genericClient.sendRequest(createPipelineRequest({
                    headers,
                    method: 'GET',
                    url: `${site.kuduUrl}/api/logstream/${logsPath}`,
                    abortSignal: abortController.signal,
                    streamResponseStatusCodes: new Set([200, 206])
                }));

                await new Promise<void>((onLogStreamEnded: () => void, reject: (err: Error) => void): void => {
                    const newLogStream: ILogStream = {
                        dispose: (): void => {
                            logsResponse.readableStreamBody?.removeAllListeners();
                            abortController.abort();
                            outputChannel.show();
                            if (timerId) {
                                clearInterval(timerId);
                            }
                            outputChannel.appendLine(vscode.l10n.t('Disconnected from log-streaming service.'));
                            newLogStream.isConnected = false;
                            void onLogStreamEnded();
                        },
                        isConnected: true,
                        outputChannel: outputChannel
                    };

                    logsResponse.readableStreamBody?.on('data', (chunk: Buffer | string) => {
                        outputChannel.append(chunk.toString());
                    }).on('error', (err: Error) => {
                        if (timerId) {
                            clearInterval(timerId);
                        }
                        newLogStream.isConnected = false;
                        outputChannel.show();
                        outputChannel.appendLine(vscode.l10n.t('Error connecting to log-streaming service:'));
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

export async function stopStreamingLogs(site: ParsedSite, logsPath: string = ''): Promise<void> {
    const logStreamId: string = getLogStreamId(site, logsPath);
    const logStream: ILogStream | undefined = logStreams.get(logStreamId);
    if (logStream && logStream.isConnected) {
        logStream.dispose();
    } else {
        await vscode.window.showWarningMessage(vscode.l10n.t('The log-streaming service is already disconnected.'));
    }
}
