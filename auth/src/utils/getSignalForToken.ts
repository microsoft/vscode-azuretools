/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

/**
 * Gets an AbortSignal that is tied to the given {@link vscode.CancellationToken}.
 * @param token The token to convert
 * @returns The {@link AbortSignal} or undefined if no token is provided
 */
export function getSignalForToken(token: vscode.CancellationToken | undefined): AbortSignal | undefined {
    if (!token) {
        return undefined;
    }

    const controller = new AbortController();
    if (token.isCancellationRequested) {
        controller.abort();
    } else {
        const disposable = token.onCancellationRequested(() => {
            disposable.dispose();
            controller.abort();
        });
    }

    return controller.signal;
}
