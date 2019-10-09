/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as retry from 'p-retry';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { delay } from '../utils/delay';

export async function syncTriggersPostDeploy(client: SiteClient): Promise<void> {
    // Per functions team a short delay is necessary before syncing triggers for two reasons:
    // (1) The call will definitely fail. (2) It will spin up a container unnecessarily in some cases.
    // Chose 10 because deploy logs say "App container will begin restart within 10 seconds."
    await delay(10 * 1000);

    // This can often fail with error "ServiceUnavailable", so we will retry with exponential backoff
    // Retry at most 5 times, with initial spacing of 5 seconds and total max time of about 3 minutes
    const retries: number = 5;
    await retry(
        async (currentAttempt: number) => {
            const message: string = currentAttempt === 1 ?
                localize('syncingTriggers', 'Syncing triggers...') :
                localize('syncingTriggersAttempt', 'Syncing triggers (Attempt {0}/{1})...', currentAttempt, retries + 1);
            ext.outputChannel.appendLog(message, { resourceName: client.fullName });
            await client.syncFunctionTriggers();
        },
        { retries, minTimeout: 5 * 1000 }
    );
}
