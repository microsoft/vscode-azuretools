/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { TokenCredential } from '@azure/core-auth';
import { bearerTokenAuthenticationPolicyName, type Pipeline, type PipelinePolicy } from '@azure/core-rest-pipeline';
import { applyChallengeBearerTokenPolicy, createChallengeBearerTokenPolicy } from '../../src/next/challengeBearerTokenPolicy';

const fakeCredential: TokenCredential = {
    getToken: () => Promise.resolve({ token: 'token', expiresOnTimestamp: 0 }),
};

suite('(unit) challengeBearerTokenPolicy', () => {
    test('createChallengeBearerTokenPolicy returns the SDK bearer token policy', () => {
        const policy = createChallengeBearerTokenPolicy({
            credential: fakeCredential,
            scopes: ['https://management.azure.com/.default'],
            getTokenForChallenge: () => Promise.resolve(undefined),
        });

        assert.strictEqual(policy.name, bearerTokenAuthenticationPolicyName);
        assert.strictEqual(typeof policy.sendRequest, 'function');
    });

    test('applyChallengeBearerTokenPolicy swaps the default bearer policy on any pipeline', () => {
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
        assert.deepStrictEqual(removed, [{ name: bearerTokenAuthenticationPolicyName }]);
        assert.strictEqual(added.length, 1);
        assert.strictEqual(added[0].name, bearerTokenAuthenticationPolicyName);
    });
});
