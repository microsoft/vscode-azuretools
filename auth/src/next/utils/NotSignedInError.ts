/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * An error indicating the user is not signed in.
 *
 * @remarks Unlike the legacy `../../utils/NotSignedInError`, this implementation does not import the
 * `vscode` namespace as a value, so it can be used in dependency-injected and unit-tested code paths.
 * Callers that want a localized message may pass one in (e.g. `vscode.l10n.t(...)`).
 */
export class NotSignedInError extends Error {
    public readonly isNotSignedInError = true;

    constructor(message?: string) {
        super(message ?? 'You are not signed in to an Azure account. Please sign in.');
    }
}

/**
 * Tests if an object is a {@link NotSignedInError}. This should be used instead of `instanceof`.
 *
 * @param error The object to test
 *
 * @returns True if the object is a {@link NotSignedInError}, false otherwise
 */
export function isNotSignedInError(error: unknown): error is NotSignedInError {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/no-unnecessary-condition
    return !!error && typeof error === 'object' && (error as NotSignedInError).isNotSignedInError === true;
}
