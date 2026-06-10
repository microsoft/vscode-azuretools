/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mock } from 'node:test';
import { expect } from 'chai';
import type { TokenCredential } from '@azure/core-auth';
import { bearerTokenAuthenticationPolicyName, createHttpHeaders, createPipelineRequest, type Pipeline, type PipelinePolicy, type PipelineResponse } from '@azure/core-rest-pipeline';
import { applyChallengeBearerTokenPolicy, createChallengeBearerTokenPolicy } from '../../src/next/challengeBearerTokenPolicy';

const fakeCredential: TokenCredential = {
    getToken: () => Promise.resolve({ token: 'token', expiresOnTimestamp: 0 }),
};

function challengeResponse(req: PipelineResponse['request']): PipelineResponse {
    return {
        request: req,
        status: 401,
        headers: createHttpHeaders({ 'WWW-Authenticate': 'Bearer realm="", authorization_uri="https://login.microsoftonline.com/common"' }),
    };
}

describe('(unit) challengeBearerTokenPolicy', () => {
    it('createChallengeBearerTokenPolicy returns the SDK bearer token policy', () => {
        const policy = createChallengeBearerTokenPolicy({
            credential: fakeCredential,
            scopes: ['https://management.azure.com/.default'],
            getTokenForChallenge: () => Promise.resolve(undefined),
        });

        expect(policy.name).to.equal(bearerTokenAuthenticationPolicyName);
        expect(typeof policy.sendRequest).to.equal('function');
    });

    it('applyChallengeBearerTokenPolicy swaps the default bearer policy on any pipeline', () => {
        const removePolicy = mock.fn((_policyDescriptor: { name: string }): PipelinePolicy[] => []);
        const addPolicy = mock.fn((_policy: PipelinePolicy) => { /* noop */ });
        const pipeline = { removePolicy, addPolicy } as unknown as Pipeline;

        applyChallengeBearerTokenPolicy(pipeline, {
            credential: fakeCredential,
            scopes: ['https://management.azure.com/.default'],
            getTokenForChallenge: () => Promise.resolve(undefined),
        });

        // The default policy is removed by name, and exactly one (configured) policy is added back.
        expect(removePolicy.mock.calls.map(c => c.arguments[0])).to.deep.equal([{ name: bearerTokenAuthenticationPolicyName }]);
        expect(addPolicy.mock.callCount()).to.equal(1);
        expect(addPolicy.mock.calls[0].arguments[0].name).to.equal(bearerTokenAuthenticationPolicyName);
    });

    describe('challenge handling', () => {
        it('retries with a fresh token when getTokenForChallenge provides one', async () => {
            const policy = createChallengeBearerTokenPolicy({
                credential: fakeCredential,
                scopes: ['https://management.azure.com/.default'],
                getTokenForChallenge: () => Promise.resolve('challenge-token'),
            });

            const request = createPipelineRequest({ url: 'https://management.azure.com/subscriptions' });
            const next = mock.fn((req: PipelineResponse['request']): Promise<PipelineResponse> =>
                Promise.resolve(next.mock.callCount() === 0
                    ? challengeResponse(req)
                    : { request: req, status: 200, headers: createHttpHeaders({}) }));

            const response = await policy.sendRequest(request, next);

            expect(response.status).to.equal(200);
            expect(request.headers.get('Authorization')).to.equal('Bearer challenge-token');
            // One challenge + one retry.
            expect(next.mock.callCount()).to.equal(2);
        });

        it('returns the challenge response unchanged when getTokenForChallenge yields no token', async () => {
            const policy = createChallengeBearerTokenPolicy({
                credential: fakeCredential,
                scopes: ['https://management.azure.com/.default'],
                getTokenForChallenge: () => Promise.resolve(undefined),
            });

            const request = createPipelineRequest({ url: 'https://management.azure.com/subscriptions' });
            const next = mock.fn((req: PipelineResponse['request']): Promise<PipelineResponse> => Promise.resolve(challengeResponse(req)));

            const response = await policy.sendRequest(request, next);

            expect(response.status).to.equal(401);
            // No token to satisfy the challenge, so the request is not retried.
            expect(next.mock.callCount()).to.equal(1);
        });
    });
});
