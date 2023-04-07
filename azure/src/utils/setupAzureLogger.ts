/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureLogger, AzureLogLevel, setLogLevel } from "@azure/logger";
import * as vscode from "vscode";

export function setupAzureLogger(logOutputChannel: vscode.LogOutputChannel): vscode.Disposable {
    const logLevelMap: Record<vscode.LogLevel, AzureLogLevel | undefined> = {
        // passing undefined to AzureLogger.setLogLevel disables logging
        [vscode.LogLevel.Off]: undefined,
        [vscode.LogLevel.Error]: 'error',
        [vscode.LogLevel.Warning]: 'warning',
        [vscode.LogLevel.Info]: 'info',
        [vscode.LogLevel.Debug]: 'verbose',
        [vscode.LogLevel.Trace]: 'verbose',
    };

    AzureLogger.log = (...args: unknown[]) => {
        logOutputChannel.debug(args.join(' '));
    };

    const disposable = logOutputChannel.onDidChangeLogLevel((logLevel: vscode.LogLevel) => {
        setLogLevel(logLevelMap[logLevel]);
    });

    return new vscode.Disposable(() => {
        AzureLogger.destroy();
        disposable.dispose();
    });
}
