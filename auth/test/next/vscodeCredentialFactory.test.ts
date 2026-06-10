/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mock } from 'node:test';
import { expect } from 'chai';
import type * as vscode from 'vscode';
import type { AzureAuthVsCode } from '../../src/next/contracts/AzureAuthVsCode';
import type { AzureAccount } from '../../src/next/contracts/AzureAccount';
import { AzurePublicCloud } from '../../src/next/contracts/EnvironmentLike';
import { createVsCodeCredentialFactory } from '../../src/next/vscodeCredentialFactory';

interface GetSessionCall {
    providerId: string;
    scopeListOrRequest: readonly string[] | vscode.AuthenticationWwwAuthenticateRequest;
    options: vscode.AuthenticationGetSessionOptions | undefined;
}

function createVsCode(settings: Record<string, unknown> = {}) {
    const getSession = mock.fn(
        (_providerId: string, _scopeListOrRequest: readonly string[] | vscode.AuthenticationWwwAuthenticateRequest, _opts?: vscode.AuthenticationGetSessionOptions) =>
            Promise.resolve({ accessToken: 'tok' } as vscode.AuthenticationSession),
    );

    const vscodeShim = {
        authentication: { getSession },
        workspace: {
            getConfiguration: (_section?: string) => ({
                get: <T>(key: string, defaultValue?: T): T => (key in settings ? settings[key] as T : defaultValue as T),
                update: () => Promise.resolve(),
            }),
        },
    } as unknown as AzureAuthVsCode;

    const calls = (): GetSessionCall[] =>
        getSession.mock.calls.map(c => ({ providerId: c.arguments[0], scopeListOrRequest: c.arguments[1], options: c.arguments[2] }));

    return { vscode: vscodeShim, calls };
}

const account: AzureAccount = { id: 'account-1', label: 'user@contoso.com', environment: AzurePublicCloud };

describe('(unit) createVsCodeCredentialFactory()', () => {
    it('produces a credential that authenticates through the injected authentication namespace', async () => {
        const { vscode, calls } = createVsCode();
        const factory = createVsCodeCredentialFactory(vscode);

        const credential = factory({ tenantId: 'tenant-a', account });
        const token = await credential.getToken('https://management.azure.com/.default');

        expect(token?.token).to.equal('tok');
        expect(calls().length).to.equal(1);
        expect(calls()[0].providerId).to.equal('microsoft');
    });

    it('binds the per-tenant scope and silent, non-interactive session options', async () => {
        const { vscode, calls } = createVsCode();
        const factory = createVsCodeCredentialFactory(vscode);

        const credential = factory({ tenantId: 'tenant-a', account });
        await credential.getToken('scope1');

        expect((calls()[0].scopeListOrRequest as string[]).includes('VSCODE_TENANT:tenant-a')).to.be.ok;
        expect(calls()[0].options?.silent).to.equal(true);
        expect(calls()[0].options?.createIfNone).to.equal(false);
        expect(calls()[0].options?.account).to.equal(account);
    });

    it('uses the sovereign provider when a sovereign cloud is configured', async () => {
        const { vscode, calls } = createVsCode({ environment: 'ChinaCloud' });
        const factory = createVsCodeCredentialFactory(vscode);

        const credential = factory({ tenantId: 'tenant-a', account });
        await credential.getToken('scope1');

        expect(calls()[0].providerId).to.equal('microsoft-sovereign-cloud');
    });
});
