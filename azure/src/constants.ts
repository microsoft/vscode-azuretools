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
        name: "ba92f5b4-2d11-453d-a403-e96b0029c9fe",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Storage Blob Data Contributor",
        description: "Allows for read, write and delete access to Azure Storage blob containers and data",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    storageBlobDataOwner: {
        name: "b7e6dc6d-f1e8-4753-8033-0f276bb0955b",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Storage Blob Data Owner",
        description: "Allows for full access to Azure Storage blob containers and data, including assigning POSIX access control.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    storageQueueDataContributor: {
        name: "974c5e8b-45b9-4653-ba55-5f855dd0fb88",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Storage Queue Data Contributor",
        description: "Read, write, and delete Azure Storage queues and queue messages.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    azureServiceBusDataReceiver: {
        name: "4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Azure Service Bus Data Receiver",
        description: "Allows for receive access to Azure Service Bus resources.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    azureServiceBusDataOwner: {
        name: "090c5cfd-751d-490a-894a-3ce6f1109419",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Azure Service Bus Data Owner",
        description: "Allows for full access to Azure Service Bus resources.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    azureEventHubsDataReceiver: {
        name: "a638d3c7-ab3a-418d-83e6-5f17a39d4fde",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Azure Event Hubs Data Receiver",
        description: "Allows receive access to Azure Event Hubs resources.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    azureEventHubsDataOwner: {
        name: "f526a384-b230-433a-b45c-95f59c4a2dec",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Azure Event Hubs Data Owner",
        description: "Allows for full access to Azure Event Hubs resources.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    cosmosDBAccountReader: {
        name: "fbdf93bf-df7d-467e-a4d2-9458aa1360c8",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Cosmos DB Account Reader",
        description: "Can read Azure Cosmos DB account data.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    documentDBAccountContributor: {
        name: "5bd9cd88-fe45-4216-938b-f97437e15450",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "DocumentDB Account Contributor",
        description: "Can manage Azure Cosmos DB accounts.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
    durableTaskDataContributor: {
        name: "0ad04412-c4d5-4796-b79c-f76d14c8d402",
        type: "Microsoft.Authorization/roleDefinitions",
        roleName: "Durable Task Data Contributor",
        description: "Durable Task role for all data access operations.",
        roleType: "BuiltInRole"
    } as RoleDefinition,
} as const;

export function createRoleId(subscriptionId: string, RoleDefinition: RoleDefinition): string {
    return `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${RoleDefinition.name}`
}
