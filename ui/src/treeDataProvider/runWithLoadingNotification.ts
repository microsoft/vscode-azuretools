/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, EventEmitter, ProgressLocation, window } from 'vscode';
import * as types from '../../index';
import { localize } from '../localize';

let notificationActive: boolean = false;

export async function runWithLoadingNotification<T>(context: types.ILoadingTreeContext, callback: (cancellationToken: CancellationToken) => Promise<T>): Promise<T> {
    if (notificationActive) {
        return await callback({
            isCancellationRequested: false,
            onCancellationRequested: (new EventEmitter()).event
        });
    } else {
        return await window.withProgress({ location: ProgressLocation.Notification, cancellable: true }, async (progress, cancellationToken) => {
            notificationActive = true;
            const message: string = context.loadingMessage || localize('loadingAll', 'Loading resources...');
            const messageDelay: number = context.loadingMessageDelay !== undefined ? context.loadingMessageDelay : 2;
            const timer: NodeJS.Timer = setTimeout(() => progress.report({ message }), messageDelay * 1000);

            try {
                return await callback(cancellationToken);
            } finally {
                clearTimeout(timer);
                notificationActive = false;
            }
        });
    }
}
