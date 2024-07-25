/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type RoleDefinition } from "@azure/arm-authorization";

export const resourcesProvider: string = 'Microsoft.Resources';
export const storageProvider: string = 'Microsoft.Storage';
export const storageProviderType = "Microsoft.Storage/storageAccounts";

export const CommonRoleDefinitions = {
    storageBlobDataContributor: {
        id: "/subscriptions/9b5c7ccb-9857-4307-843b-8875e83f65e9/providers/Microsoft.Authorization/roleDefinitions/ba92f5b4-2d11-453d-a403-e96b0029c9fe",
        name: "ba92f5b4-2d11-453d-a403-e96b0029c9fe",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Storage Blob Data Contributor",
        description: "Allows for read, write and delete access to Azure Storage blob containers and data",
        roleType: "BuiltInRole"
    } as RoleDefinition
} as const;
