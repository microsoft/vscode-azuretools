/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { LinkerResource } from "@azure/arm-servicelinker";

export function getTreeId(resourceId: string, linker: LinkerResource): string {
    return `${resourceId}/ServiceConnector/${linker.name}`;
}
