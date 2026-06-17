/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { l10n, MessageItem, MessageOptions, window } from 'vscode';
import * as types from '../../index';
import { DialogResponses } from '../DialogResponses';
import { GoBackError, UserCancelledError } from '../errors';
import { openUrl } from '../utils/openUrl';
import { IInternalActionContext } from './IInternalActionContext';

export async function showWarningMessage<T extends MessageItem>(context: IInternalActionContext, message: string, ...items: T[]): Promise<T>;
export async function showWarningMessage<T extends MessageItem>(context: IInternalActionContext, message: string, options: MessageOptions, ...items: T[]): Promise<T>;
export async function showWarningMessage<T extends MessageItem>(context: IInternalActionContext, message: string, ...args: [MessageOptions, ...T[]] | T[]): Promise<T> {
    const firstArg = args[0];
    const hasOptions = firstArg && !('title' in firstArg);
    const options: MessageOptions | undefined = hasOptions ? firstArg : undefined;
    const items: MessageItem[] = (hasOptions ? args.slice(1) : args) as MessageItem[];
    const learnMoreLink: string | undefined = options && (<types.IAzureMessageOptions>options).learnMoreLink;
    if (learnMoreLink) {
        items.push(DialogResponses.learnMore);
    }

    const back: MessageItem = { title: l10n.t('Back') };
    if (context.ui.wizard?.showBackButton) {
        items.push(back);
    }

    while (true) {
        const result: MessageItem | undefined = options ? await window.showWarningMessage(message, options, ...items) : await window.showWarningMessage(message, ...items);
        if (learnMoreLink && result === DialogResponses.learnMore) {
            context.telemetry.properties.learnMoreStep = context.telemetry.properties.lastStep;
            await openUrl(learnMoreLink);
        } else if (result === undefined || result === DialogResponses.cancel) {
            throw new UserCancelledError();
        } else if (result === back) {
            throw new GoBackError();
        } else {
            return <T>result;
        }
    }
}
