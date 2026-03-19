/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { PipelinePolicy, PipelineRequest, PipelineResponse, SendRequest } from '@azure/core-rest-pipeline';
import type * as vscode from 'vscode';

export function getDefaultScopeFromEndpoint(endpoint?: string): string {
    let base = endpoint ?? 'https://management.azure.com/';
    base = base.replace(/\/+$/, '');
    return `${base}/.default`;
}

export class BearerChallengePolicy implements PipelinePolicy {
    public readonly name = 'BearerChallengePolicy';
    private readonly challengeRetryHeader = 'x-azext-challenge-retry';

    public constructor(
        private readonly getTokenForChallenge: (request: vscode.AuthenticationWwwAuthenticateRequest) => Promise<string | undefined>,
        private readonly endpoint?: string,
    ) { }

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        const initial = await next(request);

        if (initial.status === 401 && !request.headers.get(this.challengeRetryHeader)) {
            const header = initial.headers.get('WWW-Authenticate') || initial.headers.get('www-authenticate');
            if (header) {
                const scopes = [getDefaultScopeFromEndpoint(this.endpoint)];
                request.headers.set(this.challengeRetryHeader, '1');

                const token = await this.getTokenForChallenge({ wwwAuthenticate: header, fallbackScopes: scopes });
                if (token) {
                    request.headers.set('Authorization', `Bearer ${token}`);
                    return await next(request);
                }
            }
        }

        return initial;
    }
}
