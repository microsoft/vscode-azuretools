/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TenantIdDescription } from "@azure/arm-resources-subscriptions";
import * as vscode from 'vscode';

export interface AzureTenant extends TenantIdDescription {
    account: vscode.AuthenticationSessionAccountInformation;
}
