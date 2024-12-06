import { AuthenticationSessionAccountInformation, AuthenticationGetSessionOptions, AuthenticationSession, AuthenticationForceNewSessionOptions, Event, AuthenticationSessionsChangeEvent } from "vscode";
import { VSCodeAuthentication } from "../src";

export class MockVSCodeAuthentication implements VSCodeAuthentication {
    getAccounts(_providerId: string): Thenable<readonly AuthenticationSessionAccountInformation[]> {
        throw new Error("Method not implemented.");
    }

    public getSession(providerId: string, scopes: readonly string[], options: AuthenticationGetSessionOptions & { createIfNone: true; }): Thenable<AuthenticationSession>;
    public getSession(providerId: string, scopes: readonly string[], options: AuthenticationGetSessionOptions & { forceNewSession: true | AuthenticationForceNewSessionOptions; }): Thenable<AuthenticationSession>;
    public getSession(providerId: string, scopes: readonly string[], options?: AuthenticationGetSessionOptions): Thenable<AuthenticationSession | undefined>;
    public getSession(_providerId: string, _scopes: readonly string[], _options?: AuthenticationGetSessionOptions): Thenable<AuthenticationSession | undefined> {
        throw new Error("Method not implemented.");
    }

    onDidChangeSessions: Event<AuthenticationSessionsChangeEvent>;

    constructor() {
    }
}
