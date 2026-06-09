/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TokenCredential } from '@azure/core-auth';
import { bearerTokenAuthenticationPolicy, bearerTokenAuthenticationPolicyName, type Pipeline, type PipelinePolicy } from '@azure/core-rest-pipeline';
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
 * Options for {@link createChallengeBearerTokenPolicy} and {@link applyChallengeBearerTokenPolicy}.
 */
export interface ChallengeBearerTokenPolicyOptions {
    /**
     * The credential used to acquire bearer tokens for non-challenge requests.
     */
    readonly credential: TokenCredential;

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
}

/**
 * Creates the SDK's built-in `bearerTokenAuthenticationPolicy`, configured with explicit scopes and a
 * non-CAE challenge callback. This is the reusable building block for any `@azure/core-client`-based client
 * (subscriptions, resources, etc.) that needs the same cloud-specific scopes and `WWW-Authenticate`
 * challenge handling as the subscription client.
 *
 * @remarks The built-in policy auto-handles Azure CAE/MFA `insufficient_claims` challenges itself (by
 * decoding the claims and calling `credential.getToken(scopes, { claims })`); the
 * {@link ChallengeBearerTokenPolicyOptions.getTokenForChallenge} callback only runs for *non-CAE* 401s.
 *
 * @param options The {@link ChallengeBearerTokenPolicyOptions}.
 * @returns The configured {@link PipelinePolicy}.
 */
export function createChallengeBearerTokenPolicy(options: ChallengeBearerTokenPolicyOptions): PipelinePolicy {
    return bearerTokenAuthenticationPolicy({
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
    });
}

/**
 * Replaces the default `bearerTokenAuthenticationPolicy` on the given {@link Pipeline} with a
 * challenge-aware one built from {@link createChallengeBearerTokenPolicy}. Use this on any
 * `@azure/core-client`-based client created via `createXyz(credential, { endpoint })` so it picks up the
 * cloud-specific scopes and non-CAE 401 challenge handling.
 *
 * @remarks `@azure-rest/core-client` installs a default `bearerTokenAuthenticationPolicy` that only knows
 * `{ credential, scopes }` (no challenge callbacks, and with the generic
 * `https://management.azure.com/.default` scope). This removes that default policy by name and re-adds the
 * configured one.
 *
 * @param pipeline The client {@link Pipeline} to reconfigure (e.g. `client.pipeline`).
 * @param options The {@link ChallengeBearerTokenPolicyOptions}.
 */
export function applyChallengeBearerTokenPolicy(pipeline: Pipeline, options: ChallengeBearerTokenPolicyOptions): void {
    // Remove the default bearer policy (which has neither our scopes nor challenge callbacks)...
    pipeline.removePolicy({ name: bearerTokenAuthenticationPolicyName });

    // ...and re-add the built-in policy configured with our scopes, logger, and challenge handling.
    pipeline.addPolicy(createChallengeBearerTokenPolicy(options));
}
