/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode'; // eslint-disable-line @typescript-eslint/no-unused-vars -- It is used in the doc comments
import type { AzureAccount as NextAzureAccount } from '../next/contracts/AzureAccount';
import type { ExtendedEnvironment } from '../utils/configuredAzureEnv';

/**
 * A shortcut type for {@link vscode.AuthenticationSessionAccountInformation}.
 *
 * @remarks Identical to the `./next` {@link NextAzureAccount}, except the `environment` is the richer
 * `@azure/ms-rest-azure-env`-based {@link ExtendedEnvironment} rather than the structural `EnvironmentLike`.
 */
export type AzureAccount = Omit<NextAzureAccount, 'environment'> & {
    readonly environment: ExtendedEnvironment;
};