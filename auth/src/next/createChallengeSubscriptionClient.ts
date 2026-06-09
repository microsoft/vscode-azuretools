/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createSubscription, type SubscriptionContext } from '@azure/arm-resources-subscriptions/api';
import type { TokenCredential } from '@azure/core-auth';
import type { HttpClient } from '@azure/core-rest-pipeline';
import type { AzureLogger } from '@azure/logger';

/**
 * A callback that acquires an access token in response to an authentication challenge (a non-CAE 401
 * carrying a `WWW-Authenticate` header), typically by performing an interactive `getSession`.
 *
 * @param wwwAuthenticate The raw `WWW-Authenticate` header value from the 401 response.
 * @param fallbackScopes The scopes the bearer policy is configured to request.
 * @returns The new access token, or `undefined` if a token could not be acquired (the request will not be retried).
 */
export type GetTokenForChallenge = (wwwAuthenticate: string, fallbackScopes: string[]) => Promise<string | undefined>;

/**
 * Options for {@link createChallengeSubscriptionClient}.
 */
export interface ChallengeSubscriptionClientOptions {
    /**
     * The credential used to acquire bearer tokens for non-challenge requests.
     */
    readonly credential: TokenCredential;

    /**
     * The ARM endpoint (the cloud's resource manager endpoint, with a trailing slash).
     */
    readonly endpoint: string;

    /**
     * The scopes the bearer policy should request (typically the management endpoint `.default` scope).
     */
    readonly scopes: string[];

    /**
     * The callback invoked to satisfy non-CAE authentication challenges.
     */
    readonly getTokenForChallenge: GetTokenForChallenge;

    /**
     * (Optional) A logger passed through to the bearer token policy.
     */
    readonly logger?: AzureLogger;

    /**
     * (Optional) An HTTP client override. Primarily useful for unit testing.
     */
    readonly httpClient?: HttpClient;
}

/**
 * Creates an ARM subscriptions {@link SubscriptionContext} whose default bearer token authentication policy
 * is replaced with the SDK's built-in {@link bearerTokenAuthenticationPolicy}, configured with explicit
 * scopes and challenge callbacks.
 *
 * @remarks `createSubscription` (via `@azure-rest/core-client`) installs a default
 * `bearerTokenAuthenticationPolicy` that only knows `{ credential, scopes }` (no challenge callbacks, and
 * with the generic `https://management.azure.com/.default` scope). We remove that policy and re-add the
 * built-in one configured with the cloud-specific scopes and a `authorizeRequestOnChallenge` callback. The
 * built-in policy auto-handles Azure CAE/MFA `insufficient_claims` challenges itself (by decoding the
 * claims and calling `credential.getToken(scopes, { claims })`); our callback only runs for *non-CAE* 401s.
 *
 * `@azure/core-rest-pipeline` is imported lazily to avoid eagerly loading it at extension activation time.
 *
 * @param options The {@link ChallengeSubscriptionClientOptions}.
 * @returns A configured {@link SubscriptionContext}.
 */
export async function createChallengeSubscriptionClient(options: ChallengeSubscriptionClientOptions): Promise<SubscriptionContext> {
    const { bearerTokenAuthenticationPolicy, bearerTokenAuthenticationPolicyName } = await import('@azure/core-rest-pipeline');

    const context = createSubscription(options.credential, {
        endpoint: options.endpoint,
        httpClient: options.httpClient,
    });

    // Remove the default bearer policy (which has neither our scopes nor challenge callbacks)...
    context.pipeline.removePolicy({ name: bearerTokenAuthenticationPolicyName });

    // ...and re-add the built-in policy configured with our scopes, logger, and challenge handling.
    context.pipeline.addPolicy(bearerTokenAuthenticationPolicy({
        credential: options.credential,
        scopes: options.scopes,
        logger: options.logger,
        challengeCallbacks: {
            authorizeRequestOnChallenge: async ({ request, response }) => {
                const wwwAuthenticate = response.headers.get('WWW-Authenticate') ?? response.headers.get('www-authenticate');
                if (!wwwAuthenticate) {
                    return false;
                }

                const token = await options.getTokenForChallenge(wwwAuthenticate, options.scopes);
                if (!token) {
                    return false;
                }

                request.headers.set('Authorization', `Bearer ${token}`);
                return true;
            },
        },
    }));

    return context;
}
