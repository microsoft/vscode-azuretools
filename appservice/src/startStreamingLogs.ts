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
import TelemetryReporter from 'vscode-extension-telemetry';
import { getKuduClient } from './getKuduClient';
import { localize } from './localize';
import { pingFunctionApp } from './pingFunctionApp';
import { signRequest } from './signRequest';
import { SiteClient } from './SiteClient';

export interface ILogStream extends vscode.Disposable {
    isConnected: boolean;
}

/**
 * Starts the log-streaming service. Call 'dispose()' on the returned object when you want to stop the service.
 */
export async function startStreamingLogs(client: SiteClient, reporter: TelemetryReporter | undefined, outputChannel: vscode.OutputChannel, path: string = ''): Promise<ILogStream> {
    const kuduClient: KuduClient = await getKuduClient(client);

    outputChannel.show();
    outputChannel.appendLine(localize('connectingToLogStream', 'Connecting to log stream...'));
    const httpRequest: WebResource = new WebResource();
    await signRequest(httpRequest, kuduClient.credentials);

    const requestApi: request.RequestAPI<request.Request, request.CoreOptions, {}> = request.defaults(httpRequest);
    const logStream: ILogStream = { dispose: undefined, isConnected: true };
    // Intentionally setting up a separate telemetry event and not awaiting the result here since log stream is a long-running action
    // tslint:disable-next-line:no-floating-promises
    callWithTelemetryAndErrorHandling('appService.streamingLogs', reporter, undefined, async function (this: IActionContext): Promise<void> {
        this.suppressErrorDisplay = true;
        let timerId: NodeJS.Timer | undefined;
        if (client.isFunctionApp) {
            // For Function Apps, we have to ping "/admin/host/status" every minute for logging to work
            // https://github.com/Microsoft/vscode-azurefunctions/issues/227
            await pingFunctionApp(client);
            timerId = setInterval(async () => await pingFunctionApp(client), 60 * 1000);
        }

        await new Promise((resolve: () => void, reject: (err: Error) => void): void => {
            const logsRequest: request.Request = requestApi(`${client.kuduUrl}/api/logstream/${path}`);
            logStream.dispose = (): void => {
                logsRequest.removeAllListeners();
                logsRequest.destroy();
                outputChannel.show();
                if (timerId) {
                    clearInterval(timerId);
                }
                outputChannel.appendLine(localize('logStreamDisconnected', 'Disconnected from log-streaming service.'));
                logStream.isConnected = false;
                resolve();
            };

            logsRequest.on('data', (chunk: Buffer | string) => {
                outputChannel.appendLine(chunk.toString());
            }).on('error', (err: Error) => {
                outputChannel.appendLine(localize('logStreamError', 'Error connecting to log-streaming service:'));
                outputChannel.appendLine(parseError(err).message);
                reject(err);
            }).on('complete', () => {
                logStream.dispose();
            });
        });
    });

    return logStream;
}
