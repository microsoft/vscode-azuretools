/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { NotSignedInError as NextNotSignedInError } from '../next/utils/NotSignedInError';

/**
 * An error indicating the user is not signed in.
 *
 * @remarks This is a thin wrapper around the `./next` {@link NextNotSignedInError} that supplies a
 * localized message via `vscode.l10n`. Use {@link isNotSignedInError} (re-exported below) rather than
 * `instanceof` to test for it, since errors may be thrown by either the legacy or `./next` class.
 */
export class NotSignedInError extends NextNotSignedInError {
    constructor() {
        super(vscode.l10n.t('You are not signed in to an Azure account. Please sign in.'));
    }
}

// The marker-based `isNotSignedInError` works across both the legacy and `./next` classes.
export { isNotSignedInError } from '../next/utils/NotSignedInError';
