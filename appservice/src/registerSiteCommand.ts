/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandCallback, IActionContext, IParsedError, parseError, registerCommand } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';

/**
 * Use this to get extra error handling for commands that interact directly with site APIs.
 */
export function registerSiteCommand(commandId: string, callback: CommandCallback, debounce?: number): void {
    registerCommand(
        commandId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (context, ...args: any[]) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument
                return await Promise.resolve(callback(context, ...args));
            } catch (error) {
                handleSiteErrors(context, error);
            }
        },
        debounce
    );
}

function handleSiteErrors(context: IActionContext, error: unknown): void {
    const parsedError: IParsedError = parseError(error);
    if (parsedError.errorType === '502' || parsedError.errorType === '503') {
        context.errorHandling.suppressReportIssue = true;
        const troubleshooting: string = vscode.l10n.t('View troubleshooting tips [here](https://aka.ms/AA772mm).');
        throw new Error(`${parsedError.message} ${troubleshooting}`);
    } else {
        throw error;
    }
}
