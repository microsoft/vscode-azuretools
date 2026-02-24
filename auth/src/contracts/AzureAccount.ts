/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { ExtendedEnvironment } from '../utils/configuredAzureEnv';

/**
 * A shortcut type for {@link vscode.AuthenticationSessionAccountInformation}
 */
export type AzureAccount = Readonly<vscode.AuthenticationSessionAccountInformation> & {
    readonly environment: ExtendedEnvironment;
};
