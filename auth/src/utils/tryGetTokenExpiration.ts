/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { getTokenExpiry } from '../next/utils/tryGetTokenExpiration';

/**
 * Best-effort extraction of the `exp` claim (in milliseconds) from a session's JWT ID token.
 *
 * @remarks Thin wrapper around the canonical `./next` {@link getTokenExpiry}, returning only the
 * `expiresOnTimestamp`.
 *
 * @param session The authentication session whose ID token to parse, or `undefined`.
 * @returns The token expiration time in milliseconds since the epoch, or `0` if it could not be determined.
 */
export function tryGetTokenExpiration(session: vscode.AuthenticationSession | undefined): number {
    return getTokenExpiry(session?.idToken).expiresOnTimestamp;
}