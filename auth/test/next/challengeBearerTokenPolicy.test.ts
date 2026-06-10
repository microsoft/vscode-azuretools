/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import type { TokenCredential } from '@azure/core-auth';
import { bearerTokenAuthenticationPolicyName, type Pipeline, type PipelinePolicy } from '@azure/core-rest-pipeline';
import { applyChallengeBearerTokenPolicy, createChallengeBearerTokenPolicy } from '../../src/next/challengeBearerTokenPolicy';

const fakeCredential: TokenCredential = {
    getToken: () => Promise.resolve({ token: 'token', expiresOnTimestamp: 0 }),
};

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
        const removed: Array<{ name: string }> = [];
        const added: PipelinePolicy[] = [];
        const pipeline = {
            removePolicy: (policyDescriptor: { name: string }) => { removed.push(policyDescriptor); return []; },
            addPolicy: (policy: PipelinePolicy) => { added.push(policy); },
        } as unknown as Pipeline;

        applyChallengeBearerTokenPolicy(pipeline, {
            credential: fakeCredential,
            scopes: ['https://management.azure.com/.default'],
            getTokenForChallenge: () => Promise.resolve(undefined),
        });

        // The default policy is removed by name, and exactly one (configured) policy is added back.
        expect(removed).to.deep.equal([{ name: bearerTokenAuthenticationPolicyName }]);
        expect(added.length).to.equal(1);
        expect(added[0].name).to.equal(bearerTokenAuthenticationPolicyName);
    });
});
