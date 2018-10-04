/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteClient } from '../SiteClient';

export function formatDeployLog(client: SiteClient, message: string, date?: Date): string {
    // tslint:disable-next-line:strict-boolean-expressions
    date = date || new Date();
    return `${date.toLocaleTimeString()} ${client.fullName}: ${message}`;
}
