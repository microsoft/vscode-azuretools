/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PostgresServerType } from "../create/PostgresAccountWizard/abstract/models";


export interface DBAccountTreeItem {
    hostName?: string;
    port?: string;
    connectionString?: string;

    azureData?: {
        accountName: string;
        accountId: string;
        resourceGroup?: string;
        accountKind?: string;
    }

    docDBData?: {
        masterKey: string;
        documentEndpoint: string;
    }

    postgresData?: {
        username?: string;
        password?: string;
        serverType?: PostgresServerType;
    }

}

export interface DBTreeItem extends DBAccountTreeItem {
    databaseName?: string;
}
