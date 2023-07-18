/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UserCancelledError, parseError } from "@microsoft/vscode-azext-utils";
import { authentication } from "vscode";
import { gitHubAuthProviderId, gitHubScopes } from "../constants";

export async function getGitHubAccessToken(): Promise<string> {
    try {
        const token = (await authentication.getSession(gitHubAuthProviderId, gitHubScopes, { createIfNone: true })).accessToken;
        // Workaround for VS Code returning a different token when connected to a CodeSpace in a browser
        // see https://github.com/microsoft/vscode-azurestaticwebapps/issues/827#issuecomment-1597881084 for details
        if (token.startsWith('ghu_')) {
            // Request a fake scope to force VS Code to give us a token of the right type
            return (await authentication.getSession(gitHubAuthProviderId, [...gitHubScopes, 'x-AzToolsScope'], { createIfNone: true })).accessToken;
        }
        return token;
    } catch (error) {
        // The error message is "User did not consent to login"
        if (/did not consent/i.test(parseError(error).message)) {
            throw new UserCancelledError('getGitHubToken');
        }
        throw error;
    }
}
