/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mock } from 'node:test';
import { expect } from 'chai';
import type * as vscode from 'vscode';
import { getSessionFromVSCode, type GetSessionContext } from '../../../src/next/utils/getSessionFromVSCode';

interface GetSessionCall {
    providerId: string;
    scopeListOrRequest: readonly string[] | vscode.AuthenticationWwwAuthenticateRequest;
    options: vscode.AuthenticationGetSessionOptions | undefined;
}

const DefaultScopeResource = 'https://management.core.windows.net';

function createContext() {
    const getSession = mock.fn(
        (_providerId: string, _scopeListOrRequest: readonly string[] | vscode.AuthenticationWwwAuthenticateRequest, _opts?: vscode.AuthenticationGetSessionOptions) =>
            Promise.resolve({ accessToken: 'tok' } as vscode.AuthenticationSession),
    );
    const authentication = { getSession } as unknown as GetSessionContext['authentication'];

    const context: GetSessionContext = {
        authentication,
        authProviderId: 'microsoft',
        defaultScopeResource: DefaultScopeResource,
    };

    const calls = (): GetSessionCall[] =>
        getSession.mock.calls.map(c => ({ providerId: c.arguments[0], scopeListOrRequest: c.arguments[1], options: c.arguments[2] }));

    return { context, calls };
}

describe('(unit) getSessionFromVSCode()', () => {
    it('passes the configured auth provider id', async () => {
        const { context, calls } = createContext();
        await getSessionFromVSCode(context, 'https://management.azure.com/');
        expect(calls()[0].providerId).to.equal('microsoft');
    });

    it('normalizes a single string scope to a `.default` array', async () => {
        const { context, calls } = createContext();
        await getSessionFromVSCode(context, 'https://management.azure.com/');
        expect(calls()[0].scopeListOrRequest).to.deep.equal(['https://management.azure.com/.default']);
    });

    it('passes an array of scopes through, normalizing each to `.default`', async () => {
        const { context, calls } = createContext();
        await getSessionFromVSCode(context, ['https://management.azure.com/', 'https://storage.azure.com/.default']);
        expect(calls()[0].scopeListOrRequest).to.deep.equal([
            'https://management.azure.com/.default',
            'https://storage.azure.com/.default',
        ]);
    });

    it('falls back to the default scope resource when no scopes are supplied', async () => {
        const { context, calls } = createContext();
        await getSessionFromVSCode(context);
        expect(calls()[0].scopeListOrRequest).to.deep.equal([`${DefaultScopeResource}/.default`]);
    });

    it('adds the VSCODE_TENANT scope when a tenantId is provided', async () => {
        const { context, calls } = createContext();
        await getSessionFromVSCode(context, 'https://management.azure.com/', 'my-tenant');
        expect(calls()[0].scopeListOrRequest).to.deep.equal([
            'https://management.azure.com/.default',
            'VSCODE_TENANT:my-tenant',
        ]);
    });

    it('rebuilds a challenge request, normalizing its fallbackScopes', async () => {
        const { context, calls } = createContext();
        const request: vscode.AuthenticationWwwAuthenticateRequest = {
            wwwAuthenticate: 'Bearer realm=""',
            fallbackScopes: ['https://management.azure.com/'],
        };
        await getSessionFromVSCode(context, request, 'tid');
        const sent = calls()[0].scopeListOrRequest as vscode.AuthenticationWwwAuthenticateRequest;
        expect(sent.wwwAuthenticate).to.equal('Bearer realm=""');
        expect(sent.fallbackScopes).to.deep.equal([
            'https://management.azure.com/.default',
            'VSCODE_TENANT:tid',
        ]);
    });

    it('uses the default scope resource for a challenge request with no fallbackScopes', async () => {
        const { context, calls } = createContext();
        const request: vscode.AuthenticationWwwAuthenticateRequest = { wwwAuthenticate: 'Bearer realm=""' };
        await getSessionFromVSCode(context, request);
        const sent = calls()[0].scopeListOrRequest as vscode.AuthenticationWwwAuthenticateRequest;
        expect(sent.fallbackScopes).to.deep.equal([`${DefaultScopeResource}/.default`]);
    });
});
