/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type * as vscode from 'vscode';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv, setConfiguredAzureEnv } from '../../src/next/configuredEnvironment';
import { AzureChinaCloud, AzurePublicCloud, AzureUSGovernmentCloud, type EnvironmentLike } from '../../src/next/contracts/EnvironmentLike';

interface UpdateCall { key: string; value: unknown; target: unknown }

function createVsCode(settings: Record<string, unknown>) {
    const updates: UpdateCall[] = [];
    const vscodeShim = {
        workspace: {
            getConfiguration: (_section?: string) => ({
                get: <T>(key: string, defaultValue?: T): T => (key in settings ? settings[key] as T : defaultValue as T),
                update: (key: string, value: unknown, target: unknown) => {
                    updates.push({ key, value, target });
                    if (value === undefined) {
                        settings[key] = undefined;
                    } else {
                        settings[key] = value;
                    }
                    return Promise.resolve();
                },
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
    return { vscode: vscodeShim, updates };
}

suite('(unit) configuredEnvironment', () => {
    suite('getConfiguredAzureEnv', () => {
        test('returns public cloud when unset', () => {
            const { vscode } = createVsCode({});
            const result = getConfiguredAzureEnv(vscode);
            assert.strictEqual(result.environment, AzurePublicCloud);
            assert.strictEqual(result.isCustomCloud, false);
        });

        test('returns China cloud', () => {
            const { vscode } = createVsCode({ environment: 'ChinaCloud' });
            const result = getConfiguredAzureEnv(vscode);
            assert.strictEqual(result.environment, AzureChinaCloud);
            assert.strictEqual(result.isCustomCloud, false);
        });

        test('returns US Government cloud', () => {
            const { vscode } = createVsCode({ environment: 'USGovernment' });
            const result = getConfiguredAzureEnv(vscode);
            assert.strictEqual(result.environment, AzureUSGovernmentCloud);
            assert.strictEqual(result.isCustomCloud, false);
        });

        test('returns custom cloud and preserves optional fields', () => {
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
            assert.strictEqual(result.isCustomCloud, true);
            assert.deepStrictEqual(result.environment, custom);
            assert.strictEqual(result.environment.storageEndpointSuffix, 'storage.mycloud.example');
            assert.strictEqual(result.environment.keyVaultDnsSuffix, '.vault.mycloud.example');
        });

        test('throws when custom cloud is selected but not configured', () => {
            const { vscode } = createVsCode({ environment: 'custom' });
            assert.throws(() => getConfiguredAzureEnv(vscode), /custom cloud choice is not configured/);
        });
    });

    suite('getConfiguredAuthProviderId', () => {
        test('returns microsoft for public cloud (unset)', () => {
            const { vscode } = createVsCode({});
            assert.strictEqual(getConfiguredAuthProviderId(vscode), 'microsoft');
        });

        test('returns sovereign for China cloud', () => {
            const { vscode } = createVsCode({ environment: 'ChinaCloud' });
            assert.strictEqual(getConfiguredAuthProviderId(vscode), 'microsoft-sovereign-cloud');
        });

        test('returns sovereign for custom cloud even if its name matches a built-in cloud', () => {
            const { vscode } = createVsCode({ environment: 'custom', customEnvironment: { ...AzurePublicCloud } });
            // The setting value is what matters, not the (potentially spoofed) environment name
            assert.strictEqual(getConfiguredAuthProviderId(vscode), 'microsoft-sovereign-cloud');
        });
    });

    suite('setConfiguredAzureEnv', () => {
        test('clears the setting for public cloud (undefined)', async () => {
            const { vscode, updates } = createVsCode({ environment: 'ChinaCloud' });
            await setConfiguredAzureEnv(vscode, undefined);
            assert.deepStrictEqual(updates, [{ key: 'environment', value: undefined, target: 1 }]);
        });

        test('clears the setting for explicit AzureCloud', async () => {
            const { vscode, updates } = createVsCode({});
            await setConfiguredAzureEnv(vscode, 'AzureCloud');
            assert.deepStrictEqual(updates, [{ key: 'environment', value: undefined, target: 1 }]);
        });

        test('sets the setting for a sovereign cloud', async () => {
            const { vscode, updates } = createVsCode({});
            await setConfiguredAzureEnv(vscode, 'USGovernment');
            assert.deepStrictEqual(updates, [{ key: 'environment', value: 'USGovernment', target: 1 }]);
        });

        test('sets environment=custom and customEnvironment for a custom cloud', async () => {
            const { vscode, updates } = createVsCode({});
            const custom = { ...AzureChinaCloud, name: 'MyCloud' };
            await setConfiguredAzureEnv(vscode, custom);
            assert.deepStrictEqual(updates, [
                { key: 'environment', value: 'custom', target: 1 },
                { key: 'customEnvironment', value: custom, target: 1 },
            ]);
        });
    });
});
