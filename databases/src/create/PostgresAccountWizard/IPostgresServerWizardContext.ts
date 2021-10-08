/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureDBWizardContext } from "../IAzureDBWizardContext";
import { AbstractSku, PostgresAbstractServer, PostgresServerType } from "./abstract/models";


export interface IPostgresServerWizardContext extends IAzureDBWizardContext {
    /**
     * Username without server, i.e. "user1"
     */
    shortUserName?: string;
    /**
     * Username with server, i.e. "user1@server1"
     */
    longUserName?: string;
    adminPassword?: string;

    server?: PostgresAbstractServer;
    sku?: AbstractSku;
    serverType?: PostgresServerType;
}
