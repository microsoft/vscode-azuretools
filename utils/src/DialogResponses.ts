/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { l10n, MessageItem } from 'vscode';
import * as constants from './constants';

export namespace DialogResponses {
    export const yes: MessageItem = { title: l10n.t('Yes') };
    export const no: MessageItem = { title: l10n.t('No') };
    export const cancel: MessageItem = { title: l10n.t('Cancel'), isCloseAffordance: true };
    export const deleteResponse: MessageItem = { title: l10n.t('Delete') };
    export const learnMore: MessageItem = { title: constants.learnMore };
    export const dontWarnAgain: MessageItem = { title: l10n.t('Don\'t warn again') };
    export const skipForNow: MessageItem = { title: l10n.t('Skip for now') };
    export const upload: MessageItem = { title: l10n.t("Upload") };
    export const alwaysUpload: MessageItem = { title: l10n.t("Always upload") };
    export const dontUpload: MessageItem = { title: l10n.t("Don't upload"), isCloseAffordance: true };
    export const reportAnIssue: MessageItem = { title: l10n.t("Report an issue") };
}
