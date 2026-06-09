/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createSubscription, type SubscriptionContext } from '@azure/arm-resources-subscriptions/api';
import type { HttpClient } from '@azure/core-rest-pipeline';
import { applyChallengeBearerTokenPolicy, type ChallengeBearerTokenPolicyOptions } from './challengeBearerTokenPolicy';

/**
 * Options for {@link createChallengeSubscriptionClient}.
 */
export interface ChallengeSubscriptionClientOptions extends ChallengeBearerTokenPolicyOptions {
    /**
     * The ARM endpoint (the cloud's resource manager endpoint, with a trailing slash).
     */
    readonly endpoint: string;

    /**
     * (Optional) An HTTP client override. Primarily useful for unit testing.
     */
    readonly httpClient?: HttpClient;
}

/**
 * Creates an ARM subscriptions {@link SubscriptionContext} whose default bearer token authentication policy
 * is replaced with a challenge-aware one (see {@link applyChallengeBearerTokenPolicy}), configured with
 * explicit scopes and challenge callbacks.
 *
 * @param options The {@link ChallengeSubscriptionClientOptions}.
 * @returns A configured {@link SubscriptionContext}.
 */
export function createChallengeSubscriptionClient(options: ChallengeSubscriptionClientOptions): SubscriptionContext {
    const context = createSubscription(options.credential, {
        endpoint: options.endpoint,
        httpClient: options.httpClient,
    });

    applyChallengeBearerTokenPolicy(context.pipeline, {
        credential: options.credential,
        scopes: options.scopes,
        getTokenForChallenge: options.getTokenForChallenge,
        logger: options.logger,
    });

    return context;
}