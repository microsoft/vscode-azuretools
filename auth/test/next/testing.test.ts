/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createAzureDevOpsCredential } from '../../src/next/testing';

const baseInit = { serviceConnectionId: 'service-connection', tenantId: 'tenant-1', clientId: 'client-1' };

/**
 * The subset of environment variables this suite manipulates (camelCase to satisfy lint naming rules).
 */
interface PipelineEnv {
    readonly agentBuildDirectory?: string;
    readonly systemAccessToken?: string;
    readonly systemOidcRequestUri?: string;
}

function applyEnv(env: PipelineEnv): void {
    if (env.agentBuildDirectory === undefined) { delete process.env.AGENT_BUILDDIRECTORY; } else { process.env.AGENT_BUILDDIRECTORY = env.agentBuildDirectory; }
    if (env.systemAccessToken === undefined) { delete process.env.SYSTEM_ACCESSTOKEN; } else { process.env.SYSTEM_ACCESSTOKEN = env.systemAccessToken; }
    if (env.systemOidcRequestUri === undefined) { delete process.env.SYSTEM_OIDCREQUESTURI; } else { process.env.SYSTEM_OIDCREQUESTURI = env.systemOidcRequestUri; }
}

/**
 * Snapshots the environment variables this suite manipulates, applies the given values, and returns a
 * callback that restores the previous values.
 */
function withPipelineEnv(env: PipelineEnv): () => void {
    const previous: PipelineEnv = {
        agentBuildDirectory: process.env.AGENT_BUILDDIRECTORY,
        systemAccessToken: process.env.SYSTEM_ACCESSTOKEN,
        systemOidcRequestUri: process.env.SYSTEM_OIDCREQUESTURI,
    };
    applyEnv(env);
    return () => { applyEnv(previous); };
}

suite('(unit) next/testing', () => {
    suite('createAzureDevOpsCredential', () => {
        test('rejects when required initializer values are missing', async () => {
            await assert.rejects(() => createAzureDevOpsCredential({ serviceConnectionId: '', tenantId: 't', clientId: 'c', allowOutsidePipeline: true }));
            await assert.rejects(() => createAzureDevOpsCredential({ serviceConnectionId: 's', tenantId: '', clientId: 'c', allowOutsidePipeline: true }));
            await assert.rejects(() => createAzureDevOpsCredential({ serviceConnectionId: 's', tenantId: 't', clientId: '', allowOutsidePipeline: true }));
        });

        test('rejects when created outside of a pipeline', async () => {
            const restore = withPipelineEnv({ agentBuildDirectory: undefined, systemAccessToken: 'system-token' });
            try {
                await assert.rejects(() => createAzureDevOpsCredential(baseInit), /outside of an Azure DevOps pipeline/);
            } finally {
                restore();
            }
        });

        test('rejects when no system access token is available', async () => {
            const restore = withPipelineEnv({ agentBuildDirectory: 'agent', systemAccessToken: undefined });
            try {
                await assert.rejects(() => createAzureDevOpsCredential(baseInit), /SYSTEM_ACCESSTOKEN/);
            } finally {
                restore();
            }
        });

        test('returns an AzurePipelinesCredential when running in a pipeline', async () => {
            const restore = withPipelineEnv({ agentBuildDirectory: 'agent', systemAccessToken: 'system-token', systemOidcRequestUri: 'https://example.com/oidc' });
            try {
                const credential = await createAzureDevOpsCredential(baseInit);
                assert.strictEqual(credential.constructor.name, 'AzurePipelinesCredential');
                assert.strictEqual(typeof credential.getToken, 'function');
            } finally {
                restore();
            }
        });

        test('honors an explicit systemAccessToken and allowOutsidePipeline', async () => {
            const restore = withPipelineEnv({ agentBuildDirectory: undefined, systemAccessToken: undefined, systemOidcRequestUri: 'https://example.com/oidc' });
            try {
                const credential = await createAzureDevOpsCredential({ ...baseInit, systemAccessToken: 'explicit-token', allowOutsidePipeline: true });
                assert.strictEqual(credential.constructor.name, 'AzurePipelinesCredential');
            } finally {
                restore();
            }
        });
    });
});
