/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { FileChangeType } from 'vscode';
import type { IActionContext } from './actionContext';

/**
 * The event used to signal an item change for `AzExtTreeFileSystem`
 */
export type AzExtItemChangeEvent<TItem> = { type: FileChangeType; item: TItem };

/**
 * The query of a URI used in `AzExtTreeFileSystem`
 */
export type AzExtItemQuery = {
    /**
     * The identifier of the item. Will not be displayed to the user
     */
    id: string;

    [key: string]: string | string[] | undefined;
};

/**
 * The basic parts of a URI used in `AzExtTreeFileSystem`
 */
export type AzExtItemUriParts = {
    /**
     * For display-purposes only. Will affect the tab-title and "Open Editors" panel
     */
    filePath: string;

    query: AzExtItemQuery;
};

export interface AzExtTreeFileSystemItem {
    /**
     * Warning: the identifier cannot contain plus sign '+'. No matter if it's exactly '+' or if it's URL encoded "%2B".
     */
    id: string;
    refresh?(context: IActionContext): Promise<void>;
}
