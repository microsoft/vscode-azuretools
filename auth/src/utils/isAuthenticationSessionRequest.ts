import * as vscode from 'vscode';

export function isAuthenticationSessionRequest(scopes?: string | string[] | vscode.AuthenticationSessionRequest): scopes is vscode.AuthenticationSessionRequest {
    return !!(scopes && typeof scopes === 'object' && 'challenge' in scopes);
}
