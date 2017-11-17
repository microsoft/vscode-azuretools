
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureTreeItem } from "../../index";
import { localize } from "../localize";

export class LoadMoreTreeItem implements IAzureTreeItem {
    public static label: string = localize('LoadMore', 'Load More...');
    public static contextValue: string = 'azureLoadMore';
    public readonly contextValue: string = LoadMoreTreeItem.contextValue;
    public readonly id: string = LoadMoreTreeItem.contextValue;
    public readonly label: string = LoadMoreTreeItem.label;
    public readonly commandId: string;
    constructor(commandId: string) {
        this.commandId = commandId;
    }
}
