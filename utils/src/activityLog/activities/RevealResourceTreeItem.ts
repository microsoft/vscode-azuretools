/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, GenericTreeItem } from "../../..";
import { localize } from "../../localize";

export class RevealResourceTreeItem extends GenericTreeItem {
    constructor(parent: AzExtParentTreeItem, resourceId: string) {
        super(parent, {
            contextValue: 'executeResult',
            label: localize("clickToView", "Click to view resource"),
            commandId: 'azureResourceGroups.revealResource',
        })

        this.commandArgs = [resourceId];
    }
}
