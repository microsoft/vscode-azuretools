/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, IActionContext } from "../../..";

export class ExecuteStepsTreeItem extends AzExtParentTreeItem {

    public loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        throw new Error("Method not implemented.");
    }
    public hasMoreChildrenImpl(): boolean {
        throw new Error("Method not implemented.");
    }
    public label: string;
    public contextValue: string;

}
