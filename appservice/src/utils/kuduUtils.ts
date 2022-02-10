/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, parseError } from '@microsoft/vscode-azext-utils';
import * as retry from 'p-retry';

/**
 * Kudu calls are not the most reliable - this will retry a few times with exponential backoff. Each "set" of retries will take a max of about 15 seconds
 */
export async function retryKuduCall<T>(context: IActionContext, methodName: string, callback: () => Promise<T>): Promise<T> {
    return await retry(
        async (attempt: number) => {
            if (attempt > 1) { // only add telemetry if it needed a retry
                const existingAttempt: number | undefined = context.telemetry.measurements.kuduMaxRetry;
                if (existingAttempt === undefined || existingAttempt < attempt) {
                    context.telemetry.measurements.kuduMaxRetry = attempt;
                    context.telemetry.properties.kuduRetryMethod = methodName;
                }
            }

            return await callback();
        },
        { retries: 4, minTimeout: 1000 }
    );
}

/**
 * 404 is somewhat common when listing deployment logs. This will swallow the error and display the logs we _can_ retrieve
 * https://github.com/microsoft/vscode-azureappservice/issues/1365
 */
export async function ignore404Error(context: IActionContext, callback: () => Promise<void>): Promise<void> {
    try {
        await callback();
    } catch (error) {
        if (parseError(error).errorType === '404') {
            context.telemetry.properties.ignore404Error = 'true';
        } else {
            throw error;
        }
    }
}
