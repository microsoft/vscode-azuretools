/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { EnvironmentLike } from './EnvironmentLike';

/**
 * A shortcut type for {@link vscode.AuthenticationSessionAccountInformation}, augmented with the
 * resolved {@link EnvironmentLike} the account belongs to.
 */
export type AzureAccount = Readonly<vscode.AuthenticationSessionAccountInformation> & {
    readonly environment: EnvironmentLike;
};
