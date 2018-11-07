
import { WebSiteManagementModels } from "azure-arm-website";
import * as git from 'simple-git/promise';
import { window } from "vscode";
import { localize } from "./localize";
import { SiteClient } from "./SiteClient";

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export async function getLocalGitUri(client: SiteClient): Promise<string> {
    const user: WebSiteManagementModels.User = await client.getPublishingUser();
    if (user.publishingUserName) {
        // first time users must set up deployment credentials via the Portal or they will not have a UserName
        return `https://${user.publishingUserName}@${client.gitUrl}`;
    } else {
        const setupDeploymentCredentials: string = localize('setupDeploymentCredentials', 'Blah blah blah');
        throw new Error(setupDeploymentCredentials);
    }
}

export async function addAzureToRemote(client: SiteClient, fsPath: string): Promise<void> {
    const remoteGitUri: string = await getLocalGitUri(client);
    const localGit: git.SimpleGit = git(fsPath);
    const azure: string = 'azure';
    await localGit.addRemote(azure, remoteGitUri);
    window.showInformationMessage(localize('gitRemoteAdded', 'Url "{0}" added as "{1}" Git remote.', remoteGitUri, azure));
}
