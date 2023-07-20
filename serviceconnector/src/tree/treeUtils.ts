/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { LinkerResource } from "@azure/arm-servicelinker";
import { AzExtTreeItem } from "@microsoft/vscode-azext-utils";
import { LinkerItem } from "../createLinker/createLinker";

export function getTreeId(item: LinkerItem | AzExtTreeItem, linker: LinkerResource): string {
    return `${item.id}/${linker.name}`;
}
