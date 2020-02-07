/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, IParsedError, parseError, registerCommand } from 'vscode-azureextensionui';
import { localize } from './localize';

/**
 * Use this to get extra error handling for commands that interact directly with site APIs.
 */
export function registerSiteCommand(commandId: string, callback: (context: IActionContext, ...args: unknown[]) => unknown, debounce?: number): void {
    registerCommand(
        commandId,
        async (context, ...args: unknown[]) => {
            try {
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
        const troubleshooting: string = localize('502or503Troubleshooting', 'View troubleshooting tips [here](https://aka.ms/AA772mm).');
        throw new Error(`${parsedError.message} ${troubleshooting}`);
    } else {
        throw error;
    }
}
