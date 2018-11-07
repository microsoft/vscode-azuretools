/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NameValuePair, SiteSourceControl } from 'azure-arm-website/lib/models';
import { TokenCredentials, WebResource } from 'ms-rest';
import { Response } from 'request';
import * as request from 'request-promise';
import * as vscode from 'vscode';
import { AzureTreeItem, IAzureQuickPickItem, IParsedError, parseError, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { signRequest } from './signRequest';
import { SiteClient } from './SiteClient';
import { ISiteTreeRoot } from './tree/ISiteTreeRoot';
import { nonNullProp } from './utils/nonNull';

type gitHubOrgData = { repos_url?: string };
type gitHubReposData = { repos_url?: string, url?: string, html_url?: string };
type gitHubLink = { prev?: string, next?: string, last?: string, first?: string };
// tslint:disable-next-line:no-reserved-keywords
type gitHubWebResource = WebResource & { resolveWithFullResponse?: boolean, nextLink?: string, lastLink?: string, type?: string };
const badCredentials: string = 'Bad Credentials';

export async function connectToGitHub(ti: AzureTreeItem<ISiteTreeRoot>): Promise<void> {
    const client: SiteClient = ti.root.client;
    let siteSourceControl: SiteSourceControl;
    const requestOptions: gitHubWebResource = new WebResource();
    requestOptions.resolveWithFullResponse = true;
    requestOptions.headers = {
        ['User-Agent']: 'vscode-azureappservice-extension'
    };
    const oAuth2Token: string | undefined = (await client.listSourceControls())[0].token;
    if (!oAuth2Token) {
        // we pass this error to validate the error was due to be bad cred and give the user an actionable error
        await showGitHubAuthPrompt(ti, new Error(badCredentials));
        // to prevent the GitHub appearing that it succeeded
        throw new UserCancelledError();
    }
    try {
        await signRequest(requestOptions, new TokenCredentials(oAuth2Token));
        requestOptions.url = 'https://api.github.com/user';
        const gitHubUser: Object[] = await getJsonRequest(requestOptions);
        requestOptions.url = 'https://api.github.com/user/orgs';
        const gitHubOrgs: Object[] = await getJsonRequest(requestOptions);
        const orgQuickPicks: IAzureQuickPickItem<{}>[] = createQuickPickFromJsons([gitHubUser], 'login', undefined, ['repos_url']).concat(createQuickPickFromJsons(gitHubOrgs, 'login', undefined, ['repos_url']));
        const orgQuickPick: gitHubOrgData = (await ext.ui.showQuickPick(orgQuickPicks, { placeHolder: 'Choose your organization.' })).data;
        let repoQuickPick: gitHubReposData;
        requestOptions.url = nonNullProp(orgQuickPick, 'repos_url');
        const gitHubRepos: Object[] = await getJsonRequest(requestOptions);
        let repoQuickPicks: IAzureQuickPickItem<{}>[] = createQuickPickFromJsons(gitHubRepos, 'name', undefined, ['url', 'html_url']);
        while (requestOptions.nextLink) {
            // load all the next repos at once
            requestOptions.url = nonNullProp(requestOptions, 'nextLink');
            const moreGitHubRepos: Object[] = await getJsonRequest(requestOptions);
            repoQuickPicks = repoQuickPicks.concat(createQuickPickFromJsons(moreGitHubRepos, 'name', undefined, ['url', 'html_url']));
            if (requestOptions.nextLink === requestOptions.lastLink) {
                // this is the last page of repos
                break;
            }
        }

        repoQuickPick = (await ext.ui.showQuickPick(repoQuickPicks, { placeHolder: 'Choose project.' })).data;

        requestOptions.url = `${repoQuickPick.url}/branches`;
        const gitHubBranches: Object[] = await getJsonRequest(requestOptions);
        const branchQuickPicks: IAzureQuickPickItem<{}>[] = createQuickPickFromJsons(gitHubBranches, 'name');
        const branchQuickPick: IAzureQuickPickItem<{}> = await ext.ui.showQuickPick(branchQuickPicks, { placeHolder: 'Choose branch.' });

        siteSourceControl = {
            repoUrl: repoQuickPick.html_url,
            branch: branchQuickPick.label,
            isManualIntegration: false,
            deploymentRollbackEnabled: true,
            isMercurial: false
        };
    } catch (error) {
        // pass the error to validate if it's a "Bad Credentials" error
        await showGitHubAuthPrompt(ti, error);
        throw new UserCancelledError();
    }

    try {
        const connectingToGithub: string = localize('ConnectingToGithub', '"{0}" is being connected to the GitHub repo. This may take several minutes...', client.fullName);
        const connectedToGithub: string = localize('ConnectedToGithub', '"{0}" has been connected to the GitHub repo.', client.fullName);
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: connectingToGithub }, async (): Promise<void> => {
            ext.outputChannel.appendLine(connectingToGithub);
            await client.updateSourceControl(siteSourceControl);
            vscode.window.showInformationMessage(connectedToGithub);
            ext.outputChannel.appendLine(connectedToGithub);
        });
    } catch (err) {
        try {
            // a resync will fix the first broken build
            // https://github.com/projectkudu/kudu/issues/2277
            await client.syncRepository();
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            // The portal returns 200, but is expecting a 204 which causes it to throw an error even after a successful sync
            if (parsedError.message.indexOf('"statusCode":200') === -1) {
                throw error;
            }
        }
    }
}

async function showGitHubAuthPrompt(ti: AzureTreeItem<ISiteTreeRoot>, error: Error): Promise<void> {
    const invalidToken: string = localize('tokenExpired', 'Azure\'s GitHub token in invalid.  Authorize in the "Deployment Center"');
    const goToPortal: string = localize('goToPortal', 'Go to Portal "Deployment Center"');
    const parsedError: IParsedError = parseError(error);
    if (parsedError.message.indexOf(badCredentials) > -1) {
        // the default error is just "Bad Credentials," which is an unhelpful error message
        const input: string | undefined = await vscode.window.showErrorMessage(invalidToken, goToPortal);
        if (input === goToPortal) {
            ti.openInPortal(`${ti.root.client.id}/vstscd`);
            throw new UserCancelledError();
        }
    } else {
        throw error;
    }
}

async function getJsonRequest(requestOptions: gitHubWebResource): Promise<Object[]> {
    // Reference for GitHub REST routes
    // https://developer.github.com/v3/
    // Note: blank after user implies look up authorized user
    // tslint:disable-next-line:no-unsafe-any
    const gitHubResponse: Response = await request(requestOptions).promise();
    if (gitHubResponse.headers.link) {
        const headerLink: string = <string>gitHubResponse.headers.link;
        const linkObject: gitHubLink = parseLinkHeaderToGitHubLinkObject(headerLink);
        if (linkObject.next) {
            requestOptions.nextLink = linkObject.next;
        }
        if (linkObject.last) {
            requestOptions.lastLink = linkObject.last;
        }
    }
    // tslint:disable-next-line:no-unsafe-any
    return <Object[]>JSON.parse(gitHubResponse.body);
}

/**
 * @param label Property of JSON that will be used as the QuickPicks label
 * @param description Optional property of JSON that will be used as QuickPicks description
 * @param data Optional property of JSON that will be used as QuickPicks data saved as a NameValue pair
 */
function createQuickPickFromJsons(jsons: Object[], label: string, description?: string, data?: string[]): IAzureQuickPickItem<{}>[] {
    const quickPicks: IAzureQuickPickItem<{}>[] = [];
    for (const json of jsons) {
        const dataValuePair: NameValuePair = {};

        if (!json[label]) {
            // skip this JSON if it doesn't have this label
            continue;
        }

        if (description && !json[description]) {
            // if the label exists, but the description does not, then description will just be left blank
            description = undefined;
        }

        if (data) {
            // construct value pair based off data labels provided
            for (const property of data) {
                // required to construct first otherwise cannot use property as key name
                dataValuePair[property] = json[property];
            }
        }

        quickPicks.push({
            label: <string>json[label],
            description: `${description ? json[description] : ''}`,
            data: dataValuePair
        });
    }

    return quickPicks;
}

function parseLinkHeaderToGitHubLinkObject(linkHeader: string): gitHubLink {
    const linkUrls: string[] = linkHeader.split(', ');
    const linkMap: gitHubLink = {};

    // link header response is "<https://api.github.com/organizations/6154722/repos?page=2>; rel="prev", <https://api.github.com/organizations/6154722/repos?page=4>; rel="next""
    const relative: string = 'rel=';
    for (const url of linkUrls) {
        linkMap[url.substring(url.indexOf(relative) + relative.length + 1, url.length - 1)] = url.substring(url.indexOf('<') + 1, url.indexOf('>'));
    }
    return linkMap;
}
