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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function showWarningMessage<T extends MessageItem>(context: IInternalActionContext, message: string, ...args: any[]): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const learnMoreLink: string | undefined = args[0] && (<types.IAzureMessageOptions>args[0]).learnMoreLink;
    if (learnMoreLink) {
        args.push(DialogResponses.learnMore);
    }

    const back: MessageItem = { title: l10n.t('Back') };
    if (context.ui.wizard?.showBackButton) {
        args.push(back);
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
        const result: T = await window.showWarningMessage(message, ...args);
        if (learnMoreLink && result === DialogResponses.learnMore) {
            context.telemetry.properties.learnMoreStep = context.telemetry.properties.lastStep;
            await openUrl(learnMoreLink);
        } else if (result === undefined || result === DialogResponses.cancel) {
            throw new UserCancelledError();
        } else if (result === back) {
            throw new GoBackError();
        } else {
            return result;
        }
    }
}
