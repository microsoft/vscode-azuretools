/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export type TargetServiceType = {
    name: string;
    id: string;
    type: TargetServiceTypeName;
}

export enum TargetServiceTypeName {
    Storage = 'storage',
    CosmosDB = 'cosmosDB',
    KeyVault = 'keyvault',
}

