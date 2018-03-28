/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogResponses {
    export const yes: MessageItem = { title: localize('yes', 'Yes') };
    export const no: MessageItem = { title: localize('no', 'No') };
    export const cancel: MessageItem = { title: localize('cancel', 'Cancel'), isCloseAffordance: true };
    export const deleteResponse: MessageItem = { title: localize('delete', 'Delete') };
    export const learnMore: MessageItem = { title: localize('learnMore', 'Learn more') };
    export const dontWarnAgain: MessageItem = { title: localize('dontWarnAgain', 'Don\'t warn again') };
    export const skipForNow: MessageItem = { title: localize('skipForNow', 'Skip for now') };
    export const upload: MessageItem = { title: localize('upload', "Upload") };
    export const alwaysUpload: MessageItem = { title: localize('alwaysUpload', "Always upload") };
    export const dontUpload: MessageItem = { title: localize('dontUpload', "Don't upload"), isCloseAffordance: true };
    export const reportAnIssue: MessageItem = { title: localize('reportAnIssue', "Report an issue") };
}
