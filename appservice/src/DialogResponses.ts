/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogResponses {
    export const skipForNow: MessageItem = { title: localize('azApp.SkipForNow', 'Skip for now') };
    export const yes: MessageItem = { title: localize('azApp.Yes', 'Yes') };
    export const no: MessageItem = { title: localize('azApp.No', 'No') };
    export const cancel: MessageItem = { title: localize('azApp.Cancel', 'Cancel'), isCloseAffordance: true };
}