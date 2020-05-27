/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import KuduClient from 'vscode-azurekudu';

export interface IFilesClient {

    fullName: string;
    getKuduClient(): Promise<KuduClient>;
}
