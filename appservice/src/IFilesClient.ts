/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import KuduClient from 'vscode-azurekudu';
import { IHostKeys } from './SiteClient';

export interface IFilesClient {

    fullName: string;
    defaultHostUrl: string;
    isFunctionApp: boolean;
    id: string;
    kuduUrl: string | undefined;
    getKuduClient(): Promise<KuduClient>;
    listHostKeys?(): Promise<IHostKeys>;
}
