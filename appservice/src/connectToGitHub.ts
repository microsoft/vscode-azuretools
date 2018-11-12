/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NameValuePair, SiteSourceControl } from 'azure-arm-website/lib/models';
import { TokenCredentials, WebResource } from 'ms-rest';
import * as opn from 'opn';
import { Response } from 'request';
import * as request from 'request-promise';
import * as vscode from 'vscode';
import { AzureTreeItem, DialogResponses, IAzureQuickPickItem, IParsedError, parseError, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { signRequest } from './signRequest';
import { SiteClient } from './SiteClient';
import { nonNullProp } from './utils/nonNull';

type gitHubOrgData = { repos_url?: string };
type gitHubReposData = { repos_url?: string, url?: string, html_url?: string };
type gitHubLink = { prev?: string, next?: string, last?: string, first?: string };
// tslint:disable-next-line:no-reserved-keywords
type gitHubWebResource = WebResource & { resolveWithFullResponse?: boolean, nextLink?: string, type?: string };

export async function connectToGitHub(node: AzureTreeItem, client: SiteClient, telemetryProperties?: TelemetryProperties): Promise<void> {
    const requestOptions: gitHubWebResource = new WebResource();
    requestOptions.resolveWithFullResponse = true;
    requestOptions.headers = {
        ['User-Agent']: 'vscode-azureappservice-extension'
    };
    const oAuth2Token: string | undefined = (await client.listSourceControls())[0].token;
    if (!oAuth2Token) {
        await showGitHubAuthPrompt(node, client, telemetryProperties);
        throw new UserCancelledError();
    }
    await signRequest(requestOptions, new TokenCredentials(oAuth2Token));
    requestOptions.url = 'https://api.github.com/user';
    const gitHubUser: Object[] = await getJsonRequest(requestOptions, node, client, telemetryProperties);
    requestOptions.url = 'https://api.github.com/user/orgs';
    const gitHubOrgs: Object[] = await getJsonRequest(requestOptions, node, client, telemetryProperties);
    const orgQuickPicks: IAzureQuickPickItem<{}>[] = createQuickPickFromJsons([gitHubUser], 'login', undefined, ['repos_url']).concat(createQuickPickFromJsons(gitHubOrgs, 'login', undefined, ['repos_url']));
    const orgQuickPick: gitHubOrgData = (await ext.ui.showQuickPick(orgQuickPicks, { placeHolder: 'Choose your organization.' })).data;
    let repoQuickPick: gitHubReposData;
    requestOptions.url = nonNullProp(orgQuickPick, 'repos_url');
    let repoQuickPicks: IAzureQuickPickItem<{}>[] = await getGitHubReposQuickPicks(requestOptions, node, client, telemetryProperties);
    let repoSelected: boolean = false; /* flag to determine if user clicked "Load More" */
    do {
        repoQuickPick = (await ext.ui.showQuickPick(repoQuickPicks, { placeHolder: 'Choose project.' })).data;
        if (repoQuickPick.url === requestOptions.nextLink) {
            repoQuickPicks.pop(); /* remove the stale Load more QuickPickItem */
            repoQuickPicks = repoQuickPicks.concat(await getGitHubReposQuickPicks(requestOptions, node, client, telemetryProperties));
        } else {
            repoSelected = true;
        }
    } while (!repoSelected);

    requestOptions.url = `${repoQuickPick.url}/branches`;
    const gitHubBranches: Object[] = await getJsonRequest(requestOptions, node, client, telemetryProperties);
    const branchQuickPicks: IAzureQuickPickItem<{}>[] = createQuickPickFromJsons(gitHubBranches, 'name');
    const branchQuickPick: IAzureQuickPickItem<{}> = await ext.ui.showQuickPick(branchQuickPicks, { placeHolder: 'Choose branch.' });

    const siteSourceControl: SiteSourceControl = {
        repoUrl: repoQuickPick.html_url,
        branch: branchQuickPick.label,
        isManualIntegration: false,
        deploymentRollbackEnabled: true,
        isMercurial: false
    };

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

async function showGitHubAuthPrompt(node: AzureTreeItem, client: SiteClient, telemetryProperties?: TelemetryProperties): Promise<void> {
    const invalidToken: string = localize('tokenExpired', 'Azure\'s GitHub token in invalid.  Authorize in the "Deployment Center"');
    const goToPortal: vscode.MessageItem = { title: localize('goToPortal', 'Go to Portal') };
    let input: vscode.MessageItem | undefined = DialogResponses.learnMore;
    while (input === DialogResponses.learnMore) {
        input = await vscode.window.showErrorMessage(invalidToken, goToPortal, DialogResponses.learnMore);
        if (input === DialogResponses.learnMore) {
            if (telemetryProperties) {
                telemetryProperties.githubLearnMore = 'true';
            }
            // tslint:disable-next-line:no-unsafe-any
            opn('https://aka.ms/B7g6sw');
        }
    }

    if (input === goToPortal) {
        if (telemetryProperties) {
            telemetryProperties.githubGoToPortal = 'true';
        }
        node.openInPortal(`${client.id}/vstscd`);
    }
}

async function getJsonRequest(requestOptions: gitHubWebResource, node: AzureTreeItem, client: SiteClient, telemetryProperties?: TelemetryProperties): Promise<Object[]> {
    // Reference for GitHub REST routes
    // https://developer.github.com/v3/
    // Note: blank after user implies look up authorized user
    try {
        // tslint:disable-next-line:no-unsafe-any
        const gitHubResponse: Response = await request(requestOptions).promise();
        if (gitHubResponse.headers.link) {
            const headerLink: string = <string>gitHubResponse.headers.link;
            const linkObject: gitHubLink = parseLinkHeaderToGitHubLinkObject(headerLink);
            requestOptions.nextLink = linkObject.next;
        }
        // tslint:disable-next-line:no-unsafe-any
        return <Object[]>JSON.parse(gitHubResponse.body);
    } catch (error) {
        const parsedError: IParsedError = parseError(error);
        if (parsedError.message.indexOf('Bad credentials') > -1) {
            // the default error is just "Bad credentials," which is an unhelpful error message
            await showGitHubAuthPrompt(node, client, telemetryProperties);
            throw new UserCancelledError();
        } else {
            throw error;
        }
    }
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

async function getGitHubReposQuickPicks(requestOptions: gitHubWebResource, node: AzureTreeItem, client: SiteClient, telemetryProperties?: TelemetryProperties, timeoutSeconds: number = 10): Promise<IAzureQuickPickItem<{}>[]> {
    const timeoutMs: number = timeoutSeconds * 1000;
    const startTime: number = Date.now();
    let gitHubRepos: Object[] = [];
    do {
        gitHubRepos = gitHubRepos.concat(await getJsonRequest(requestOptions, node, client, telemetryProperties));
        if (requestOptions.nextLink) {
            // if there is another link, set the next request url to point at that
            requestOptions.url = requestOptions.nextLink;
        }
    } while (requestOptions.nextLink && startTime + timeoutMs > Date.now());

    const result: IAzureQuickPickItem<{}>[] = createQuickPickFromJsons(gitHubRepos, 'name', undefined, ['url', 'html_url']);

    // this adds a "Load More" QuickPick with the nextLink as the data which will be used in the next getJsonRequest
    if (requestOptions.nextLink) {
        result.push({
            label: '$(sync) Load More',
            description: '',
            data: {
                url: requestOptions.nextLink
            },
            suppressPersistence: true
        });
    }

    return result;
}
