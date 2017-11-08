/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem } from "vscode";

export interface IQuickPickItemWithData<T> extends QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}
