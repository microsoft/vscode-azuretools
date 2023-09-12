/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export type TargetServiceType = {
    name: string;
    id: string;
    type: TargetServiceTypeName;
    group: TargetServiceTypeName;
}

export enum TargetServiceTypeName {
    Storage = 'Storage',
    MongoDB = 'MongoDB',
    Cassandra = 'Cassandra',
    Gremlin = 'Gremlin, Sql',
    NoSQL = 'Sql',
    Table = 'Table, Sql',
    CosmosDB = 'Cosmos DB',
    KeyVault = 'Key Vault',
}

