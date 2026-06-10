/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mock } from 'node:test';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type * as vscode from 'vscode';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv, setConfiguredAzureEnv } from '../../src/next/configuredEnvironment';
import { AzureChinaCloud, AzurePublicCloud, AzureUSGovernmentCloud, type EnvironmentLike } from '../../src/next/contracts/EnvironmentLike';

use(chaiAsPromised);

interface UpdateCall { key: string; value: unknown; target: unknown }

function createVsCode(settings: Record<string, unknown>) {
    const update = mock.fn((key: string, value: unknown, _target?: unknown) => {
        if (value === undefined) {
            settings[key] = undefined;
        } else {
            settings[key] = value;
        }
        return Promise.resolve();
    });

    const vscodeShim = {
        workspace: {
            getConfiguration: (_section?: string) => ({
                get: <T>(key: string, defaultValue?: T): T => (key in settings ? settings[key] as T : defaultValue as T),
                update,
            }),
            onDidChangeConfiguration: () => ({ dispose: () => { /* noop */ } }),
        } as unknown as typeof vscode.workspace,
        l10n: {
            t: (message: string, ...args: unknown[]): string => {
                return message.replace(/\{(\d+)\}/g, (_m, i) => String(args[Number(i)]));
            },
        } as unknown as typeof vscode.l10n,
        ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 } as unknown as typeof vscode.ConfigurationTarget,
    };

    const updates = (): UpdateCall[] =>
        update.mock.calls.map(c => ({ key: c.arguments[0], value: c.arguments[1], target: c.arguments[2] }));

    return { vscode: vscodeShim, updates };
}

describe('(unit) configuredEnvironment', () => {
    describe('getConfiguredAzureEnv', () => {
        it('returns public cloud when unset', () => {
            const { vscode } = createVsCode({});
            const result = getConfiguredAzureEnv(vscode);
            expect(result.environment).to.equal(AzurePublicCloud);
            expect(result.isCustomCloud).to.equal(false);
        });

        it('returns China cloud', () => {
            const { vscode } = createVsCode({ environment: 'ChinaCloud' });
            const result = getConfiguredAzureEnv(vscode);
            expect(result.environment).to.equal(AzureChinaCloud);
            expect(result.isCustomCloud).to.equal(false);
        });

        it('returns US Government cloud', () => {
            const { vscode } = createVsCode({ environment: 'USGovernment' });
            const result = getConfiguredAzureEnv(vscode);
            expect(result.environment).to.equal(AzureUSGovernmentCloud);
            expect(result.isCustomCloud).to.equal(false);
        });

        it('returns custom cloud and preserves optional fields', () => {
            const custom: EnvironmentLike = {
                name: 'MyCloud',
                portalUrl: 'https://portal.mycloud.example/',
                managementEndpointUrl: 'https://management.mycloud.example',
                resourceManagerEndpointUrl: 'https://arm.mycloud.example/',
                activeDirectoryEndpointUrl: 'https://login.mycloud.example/',
                activeDirectoryResourceId: 'https://management.mycloud.example/',
                storageEndpointSuffix: 'storage.mycloud.example',
                keyVaultDnsSuffix: '.vault.mycloud.example',
            };
            const { vscode } = createVsCode({ environment: 'custom', customEnvironment: custom });
            const result = getConfiguredAzureEnv(vscode);
            expect(result.isCustomCloud).to.equal(true);
            expect(result.environment).to.deep.equal(custom);
            expect(result.environment.storageEndpointSuffix).to.equal('storage.mycloud.example');
            expect(result.environment.keyVaultDnsSuffix).to.equal('.vault.mycloud.example');
        });

        it('throws when custom cloud is selected but not configured', () => {
            const { vscode } = createVsCode({ environment: 'custom' });
            expect(() => getConfiguredAzureEnv(vscode)).to.throw(/custom cloud choice is not configured/);
        });
    });

    describe('getConfiguredAuthProviderId', () => {
        it('returns microsoft for public cloud (unset)', () => {
            const { vscode } = createVsCode({});
            expect(getConfiguredAuthProviderId(vscode)).to.equal('microsoft');
        });

        it('returns sovereign for China cloud', () => {
            const { vscode } = createVsCode({ environment: 'ChinaCloud' });
            expect(getConfiguredAuthProviderId(vscode)).to.equal('microsoft-sovereign-cloud');
        });

        it('returns sovereign for US Government cloud', () => {
            const { vscode } = createVsCode({ environment: 'USGovernment' });
            expect(getConfiguredAuthProviderId(vscode)).to.equal('microsoft-sovereign-cloud');
        });

        it('returns microsoft for an unrecognized (legacy) value, consistent with getConfiguredAzureEnv', () => {
            const { vscode } = createVsCode({ environment: 'AzureCloud' });
            expect(getConfiguredAuthProviderId(vscode)).to.equal('microsoft');
        });

        it('returns sovereign for custom cloud even if its name matches a built-in cloud', () => {
            const { vscode } = createVsCode({ environment: 'custom', customEnvironment: { ...AzurePublicCloud } });
            // The setting value is what matters, not the (potentially spoofed) environment name
            expect(getConfiguredAuthProviderId(vscode)).to.equal('microsoft-sovereign-cloud');
        });
    });

    describe('setConfiguredAzureEnv', () => {
        it('clears the setting for public cloud (undefined)', async () => {
            const { vscode, updates } = createVsCode({ environment: 'ChinaCloud' });
            await setConfiguredAzureEnv(vscode, undefined);
            expect(updates()).to.deep.equal([{ key: 'environment', value: undefined, target: 1 }]);
        });

        it('clears the setting for explicit AzureCloud', async () => {
            const { vscode, updates } = createVsCode({});
            await setConfiguredAzureEnv(vscode, 'AzureCloud');
            expect(updates()).to.deep.equal([{ key: 'environment', value: undefined, target: 1 }]);
        });

        it('sets the setting for a sovereign cloud', async () => {
            const { vscode, updates } = createVsCode({});
            await setConfiguredAzureEnv(vscode, 'USGovernment');
            expect(updates()).to.deep.equal([{ key: 'environment', value: 'USGovernment', target: 1 }]);
        });

        it('sets environment=custom and customEnvironment for a custom cloud', async () => {
            const { vscode, updates } = createVsCode({});
            const custom = { ...AzureChinaCloud, name: 'MyCloud' };
            await setConfiguredAzureEnv(vscode, custom);
            expect(updates()).to.deep.equal([
                { key: 'environment', value: 'custom', target: 1 },
                { key: 'customEnvironment', value: custom, target: 1 },
            ]);
        });

        it('throws for an invalid cloud value', async () => {
            const { vscode } = createVsCode({});
            await expect(setConfiguredAzureEnv(vscode, 42 as unknown as Parameters<typeof setConfiguredAzureEnv>[1])).to.be.rejectedWith(/Invalid cloud value/);
        });
    });
});
