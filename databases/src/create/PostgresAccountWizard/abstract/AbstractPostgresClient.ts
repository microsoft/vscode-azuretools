/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { PostgreSQLManagementClient } from "@azure/arm-postgresql";
import type { PostgreSQLManagementClient as PostgreSQLFlexibleManagementClient } from "@azure/arm-postgresql-flexible";
import { AzExtClientContext } from "@microsoft/vscode-azext-azureutils";
import { createPostgreSQLClient, createPostgreSQLFlexibleClient } from "../../../utils/azureClients";
import { PostgresServerType } from "./models";

export type AbstractPostgresClient = PostgreSQLFlexibleManagementClient | PostgreSQLManagementClient;

export async function createAbstractPostgresClient(serverType: PostgresServerType, context: AzExtClientContext): Promise<AbstractPostgresClient> {
    switch (serverType) {
        case PostgresServerType.Flexible:
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return await createPostgreSQLFlexibleClient(context)
        case PostgresServerType.Single:
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return await createPostgreSQLClient(context)
        default:
            throw new Error("Service not implemented.");
    }
}
