/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export type ServiceType = {
    name: string;
    id: string;
    type: ServiceTypeNames;
}

export enum ServiceTypeNames {
    storage = 'storage',
    //add database types
}

