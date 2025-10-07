/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export * from './AzureAuthentication';
export * from './AzureDevOpsSubscriptionProvider';
export * from './AzureSubscription';
export * from './AzureSubscriptionProvider';
export * from './AzureTenant';
export * from './NotSignedInError';
export * from './signInToTenant';
export * from './utils/configuredAzureEnv';
export * from './utils/getUnauthenticatedTenants';
export * from './VSCodeAzureSubscriptionProvider';

// Temporary until @types/vscode 1.105.0 is published
declare module 'vscode' {
    /**
     * Represents parameters for creating a session based on a WWW-Authenticate header value.
     * This is used when an API returns a 401 with a WWW-Authenticate header indicating
     * that additional authentication is required. The details of which will be passed down
     * to the authentication provider to create a session.
     *
     * @note The authorization provider must support handling challenges and specifically
     * the challenges in this WWW-Authenticate value.
     * @note For more information on WWW-Authenticate please see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/WWW-Authenticate
     */
    export interface AuthenticationWwwAuthenticateRequest {
        /**
         * The raw WWW-Authenticate header value that triggered this challenge.
         * This will be parsed by the authentication provider to extract the necessary
         * challenge information.
         */
        readonly wwwAuthenticate: string;

        /**
         * The fallback scopes to use if no scopes are found in the WWW-Authenticate header.
         */
        readonly fallbackScopes?: readonly string[];
    }

    /**
     * Namespace for authentication.
     */
    export namespace authentication {
        /**
         * Get an authentication session matching the desired scopes or request. Rejects if a provider with providerId is not
         * registered, or if the user does not consent to sharing authentication information with the extension. If there
         * are multiple sessions with the same scopes, the user will be shown a quickpick to select which account they would like to use.
         *
         * Built-in auth providers include:
         * * 'github' - For GitHub.com
         * * 'microsoft' For both personal & organizational Microsoft accounts
         * * (less common) 'github-enterprise' - for alternative GitHub hostings, GHE.com, GitHub Enterprise Server
         * * (less common) 'microsoft-sovereign-cloud' - for alternative Microsoft clouds
         *
         * @param providerId The id of the provider to use
         * @param scopeListOrRequest A scope list of permissions requested or a WWW-Authenticate request. These are dependent on the authentication provider.
         * @param options The {@link AuthenticationGetSessionOptions} to use
         * @returns A thenable that resolves to an authentication session or undefined if a silent flow was used and no session was found
         */
        export function getSession(providerId: string, scopeListOrRequest: ReadonlyArray<string> | AuthenticationWwwAuthenticateRequest, options?: AuthenticationGetSessionOptions): Thenable<AuthenticationSession | undefined>;
    }
}
