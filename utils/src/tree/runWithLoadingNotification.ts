/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, l10n, ProgressLocation, window } from 'vscode';
import * as types from '../../index';

export async function runWithLoadingNotification<T>(context: types.ILoadingTreeContext, callback: (cancellationToken: CancellationToken) => Promise<T>): Promise<T> {
    return await window.withProgress({ location: ProgressLocation.Notification, cancellable: true }, async (progress, cancellationToken) => {
        const message: string = context.loadingMessage || l10n.t('Loading resources...');
        const messageDelay: number = context.loadingMessageDelay !== undefined ? context.loadingMessageDelay : 2;
        const timer: NodeJS.Timer = setTimeout(() => progress.report({ message }), messageDelay * 1000);

        try {
            return await callback(cancellationToken);
        } finally {
            clearTimeout(timer);
        }
    });
}
