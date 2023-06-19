/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UserCancelledError, parseError } from "@microsoft/vscode-azext-utils";
import { authentication } from "vscode";

// Provide same scopes as the GitHub extension so we don't have to prompt for auth again
const gitHubScopes: string[] = ['repo', 'workflow', 'user:email', 'read:user'];

export async function getGitHubAccessToken(): Promise<string> {
    try {
        return (await authentication.getSession('github', gitHubScopes, { createIfNone: true })).accessToken;
    } catch (error) {
        if (parseError(error).message === 'User did not consent to login.') {
            throw new UserCancelledError('getGitHubToken');
        }
        throw error;
    }
}
