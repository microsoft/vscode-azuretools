import { AuthenticationSessionAccountInformation, AuthenticationGetSessionOptions, AuthenticationSession, AuthenticationForceNewSessionOptions, Event, AuthenticationSessionsChangeEvent } from "vscode";
import { VSCodeAuthentication } from "../src";
import * as assert from 'assert';

interface GetSessionArgs {
    providerId: string;
    scopes: readonly string[];
    options?: AuthenticationGetSessionOptions;
}

export class TestVSCodeAuthentication implements VSCodeAuthentication {
    onDidChangeSessions: Event<AuthenticationSessionsChangeEvent>;
    getAccounts(_providerId: string): Thenable<readonly AuthenticationSessionAccountInformation[]> {
        throw new Error("Method not implemented.");
    }

    public getSession(providerId: string, scopes: readonly string[], options: AuthenticationGetSessionOptions & { createIfNone: true; }): Thenable<AuthenticationSession>;
    public getSession(providerId: string, scopes: readonly string[], options: AuthenticationGetSessionOptions & { forceNewSession: true | AuthenticationForceNewSessionOptions; }): Thenable<AuthenticationSession>;
    public getSession(providerId: string, scopes: readonly string[], options?: AuthenticationGetSessionOptions): Thenable<AuthenticationSession | undefined> {
        if (this.expectedArgs) {
            assert.deepStrictEqual({ providerId, scopes, options }, this.expectedArgs);
        }
        return Promise.resolve(undefined);
    }

    private expectedArgs: GetSessionArgs | undefined = undefined;
    public async callWithExpectedArgs(expected: GetSessionArgs, callback: () => Promise<void>): Promise<void> {
        this.expectedArgs = expected;
        await callback();
        this.expectedArgs = undefined;
    }
}
