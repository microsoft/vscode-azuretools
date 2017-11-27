/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogResponses {
    export const yes: MessageItem = { title: localize('Yes', 'Yes') };
    export const no: MessageItem = { title: localize('No', 'No') };
    export const cancel: MessageItem = { title: localize('Cancel', 'Cancel'), isCloseAffordance: true };
}
