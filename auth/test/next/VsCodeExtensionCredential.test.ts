/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type * as vscode from 'vscode';
import { AzureChinaCloud, AzurePublicCloud } from '../../src/next/contracts/EnvironmentLike';
import { VsCodeExtensionCredential, type VsCodeExtensionCredentialOptions } from '../../src/next/VsCodeExtensionCredential';

interface GetSessionCall {
    providerId: string;
    scopeListOrRequest: readonly string[] | vscode.AuthenticationWwwAuthenticateRequest;
    options: vscode.AuthenticationGetSessionOptions | undefined;
}

function createCredential(options?: Partial<VsCodeExtensionCredentialOptions>, sessionResult?: Partial<vscode.AuthenticationSession>) {
    const calls: GetSessionCall[] = [];
    const authentication = {
        getSession: (providerId: string, scopeListOrRequest: readonly string[] | vscode.AuthenticationWwwAuthenticateRequest, opts?: vscode.AuthenticationGetSessionOptions) => {
            calls.push({ providerId, scopeListOrRequest, options: opts });
            return Promise.resolve(sessionResult as vscode.AuthenticationSession | undefined);
        },
    } as unknown as VsCodeExtensionCredentialOptions['authentication'];

    const credential = new VsCodeExtensionCredential({ authentication, ...options });
    return { credential, calls };
}

function makeIdToken(payload: object, encoding: 'base64' | 'base64url' = 'base64'): string {
    const body = Buffer.from(JSON.stringify(payload)).toString(encoding);
    return `header.${body}.signature`;
}

suite('(unit) VsCodeExtensionCredential', () => {
    test('uses the "microsoft" provider for the default (public) cloud', async () => {
        const { credential, calls } = createCredential(undefined, { accessToken: 'tok' });
        await credential.getToken('https://management.azure.com/.default');
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].providerId, 'microsoft');
    });

    test('uses the sovereign provider for non-public environments', async () => {
        const { credential, calls } = createCredential({ environment: AzureChinaCloud }, { accessToken: 'tok' });
        await credential.getToken('scope1');
        assert.strictEqual(calls[0].providerId, 'microsoft-sovereign-cloud');
    });

    test('uses the "microsoft" provider when environment is explicitly public cloud', async () => {
        const { credential, calls } = createCredential({ environment: AzurePublicCloud }, { accessToken: 'tok' });
        await credential.getToken('scope1');
        assert.strictEqual(calls[0].providerId, 'microsoft');
    });

    test('honors an explicit authProviderId over the environment', async () => {
        const { credential, calls } = createCredential({ environment: AzurePublicCloud, authProviderId: 'my-custom-provider' }, { accessToken: 'tok' });
        await credential.getToken('scope1');
        assert.strictEqual(calls[0].providerId, 'my-custom-provider');
    });

    test('passes a single scope through as an array', async () => {
        const { credential, calls } = createCredential(undefined, { accessToken: 'tok' });
        await credential.getToken('scope1');
        assert.deepStrictEqual(calls[0].scopeListOrRequest, ['scope1']);
    });

    test('passes multiple scopes through as an array', async () => {
        const { credential, calls } = createCredential(undefined, { accessToken: 'tok' });
        await credential.getToken(['scope1', 'scope2']);
        assert.deepStrictEqual(calls[0].scopeListOrRequest, ['scope1', 'scope2']);
    });

    test('adds VSCODE_TENANT scope from constructor tenantId', async () => {
        const { credential, calls } = createCredential({ tenantId: 'my-tenant' }, { accessToken: 'tok' });
        await credential.getToken('scope1');
        assert.ok((calls[0].scopeListOrRequest as string[]).includes('VSCODE_TENANT:my-tenant'));
    });

    test('prefers GetTokenOptions.tenantId over constructor tenantId', async () => {
        const { credential, calls } = createCredential({ tenantId: 'default-tenant' }, { accessToken: 'tok' });
        await credential.getToken('scope1', { tenantId: 'override-tenant' });
        assert.ok((calls[0].scopeListOrRequest as string[]).includes('VSCODE_TENANT:override-tenant'));
        assert.ok(!(calls[0].scopeListOrRequest as string[]).includes('VSCODE_TENANT:default-tenant'));
    });

    test('does not add a tenant scope when no tenantId is provided', async () => {
        const { credential, calls } = createCredential(undefined, { accessToken: 'tok' });
        await credential.getToken('scope1');
        assert.ok(!(calls[0].scopeListOrRequest as string[]).some(s => s.startsWith('VSCODE_TENANT:')));
    });

    test('forwards sessionOptions for normal requests', async () => {
        const { credential, calls } = createCredential({ sessionOptions: { silent: true } }, { accessToken: 'tok' });
        await credential.getToken('scope1');
        assert.deepStrictEqual(calls[0].options, { silent: true });
    });

    test('returns null when getSession returns undefined', async () => {
        const { credential } = createCredential();
        const result = await credential.getToken('scope1');
        assert.strictEqual(result, null);
    });

    test('returns an AccessToken when a session is available', async () => {
        const { credential } = createCredential(undefined, { accessToken: 'my-token-value' });
        const result = await credential.getToken('scope1');
        assert.ok(result);
        assert.strictEqual(result.token, 'my-token-value');
        assert.strictEqual(result.tokenType, 'Bearer');
        assert.strictEqual(result.expiresOnTimestamp, 0);
    });

    test('extracts expiresOnTimestamp from the idToken exp claim', async () => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const { credential } = createCredential(undefined, { accessToken: 'tok', idToken: makeIdToken({ exp }) });
        const result = await credential.getToken('scope1');
        assert.strictEqual(result!.expiresOnTimestamp, exp * 1000);
    });

    test('sets refreshAfterTimestamp to ~2/3 of remaining lifetime', async () => {
        const now = Date.now();
        const exp = Math.floor(now / 1000) + 3600;
        const { credential } = createCredential(undefined, { accessToken: 'tok', idToken: makeIdToken({ exp }) });
        const result = await credential.getToken('scope1');
        const expectedRefresh = now + Math.floor((exp * 1000 - now) * 2 / 3);
        assert.ok(Math.abs(result!.refreshAfterTimestamp! - expectedRefresh) < 2000);
    });

    test('falls back to 0 when idToken is malformed', async () => {
        const { credential } = createCredential(undefined, { accessToken: 'tok', idToken: 'not-a-jwt' });
        const result = await credential.getToken('scope1');
        assert.strictEqual(result!.expiresOnTimestamp, 0);
        assert.strictEqual(result!.refreshAfterTimestamp, 0);
    });

    test('decodes base64url-encoded idToken payloads', async () => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const { credential } = createCredential(undefined, { accessToken: 'tok', idToken: makeIdToken({ exp }, 'base64url') });
        const result = await credential.getToken('scope1');
        assert.strictEqual(result!.expiresOnTimestamp, exp * 1000);
    });

    test('sets refreshAfterTimestamp to expiresOnTimestamp for an already-expired token', async () => {
        const exp = Math.floor(Date.now() / 1000) - 60;
        const { credential } = createCredential(undefined, { accessToken: 'tok', idToken: makeIdToken({ exp }) });
        const result = await credential.getToken('scope1');
        assert.strictEqual(result!.expiresOnTimestamp, exp * 1000);
        assert.strictEqual(result!.refreshAfterTimestamp, exp * 1000);
    });

    suite('claims challenge (MFA / Conditional Access)', () => {
        test('performs an interactive getSession with a reconstructed WWW-Authenticate request', async () => {
            const { credential, calls } = createCredential(undefined, { accessToken: 'challenge-tok' });
            const claims = '{"access_token":{"foo":"bar"}}';
            await credential.getToken('scope1', { claims });

            assert.strictEqual(calls.length, 1);
            const request = calls[0].scopeListOrRequest as vscode.AuthenticationWwwAuthenticateRequest;
            assert.ok(typeof request === 'object' && 'wwwAuthenticate' in request, 'should send a challenge request');
            assert.ok(request.wwwAuthenticate.includes('error="insufficient_claims"'));
            // The reconstructed header should carry the claims base64-encoded so VS Code can parse them
            assert.ok(request.wwwAuthenticate.includes(Buffer.from(claims).toString('base64')));
            assert.deepStrictEqual(request.fallbackScopes, ['scope1']);
            assert.strictEqual(calls[0].options?.createIfNone, true, 'challenge sign-in must be interactive');
        });

        test('includes the tenant scope in the challenge request fallback scopes', async () => {
            const { credential, calls } = createCredential({ tenantId: 'tid' }, { accessToken: 'tok' });
            await credential.getToken('scope1', { claims: '{}' });
            const request = calls[0].scopeListOrRequest as vscode.AuthenticationWwwAuthenticateRequest;
            assert.ok(request.fallbackScopes!.includes('VSCODE_TENANT:tid'));
        });
    });
});
