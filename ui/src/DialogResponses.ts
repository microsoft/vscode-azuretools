/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogResponses {
    export const upload: MessageItem = { title: localize('upload', "Upload") };
    export const dontWarn: MessageItem = { title: localize('dontwarn', "Upload, don't warn again") };
    export const dontUpload: MessageItem = { title: localize('dontUpload', "Don't Upload"), isCloseAffordance: true };
    export const OK: MessageItem = { title: localize('OK', 'OK') };
}