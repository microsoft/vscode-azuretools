/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

export function tryGetTokenExpiration(session: vscode.AuthenticationSession | undefined): number {
    try {
        if (!!session && 'idToken' in session && typeof session.idToken === 'string' && !!session.idToken) {
            const idTokenParts = session.idToken.split('.');
            if (idTokenParts.length === 3) {
                const payload = JSON.parse(Buffer.from(idTokenParts[1], 'base64').toString()) as { exp?: number };
                if (payload.exp) {
                    return payload.exp * 1000; // Convert to milliseconds
                }
            }
        }
    } catch {
        // Best effort only
    }
    return 0;
}
