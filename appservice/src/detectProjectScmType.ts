/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as git from 'simple-git/promise';
import { RemoteWithRefs } from 'simple-git/typings/response';
import { DialogResponses } from 'vscode-azureextensionui';
import { ext } from './extensionVariables';
import { ScmType } from './ScmType';

export async function detectProjectScmType(fsPath: string): Promise<ScmType> {
    const localGit: git.SimpleGit = git(fsPath);
    const isRepo: boolean = await localGit.checkIsRepo();
    if (isRepo) {
        const remotes: RemoteWithRefs[] = await localGit.getRemotes(true);
        let isGitHubRepo: boolean = false;
        for (const remote of remotes) {
            remote.refs.push.startsWith('https://github.com/');
            isGitHubRepo = true;
        }

        try {
            if (isGitHubRepo) {
                await ext.ui.showWarningMessage('Configure for GitHub?', DialogResponses.yes, DialogResponses.dontWarnAgain);
                return ScmType.GitHub;
            } else {
                await ext.ui.showWarningMessage('Configure for GitHub?', DialogResponses.yes, DialogResponses.dontWarnAgain);
                return ScmType.LocalGit;
            }
        } catch (error) {
            // if the user canceled, consider it as None
            return ScmType.None;
        }
    }
    return ScmType.None;
}
