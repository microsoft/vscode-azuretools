/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { AppServicePlan, NameValuePair, Site, SiteConfigResource, SiteLogsConfig, SiteSourceControl, User } from 'azure-arm-website/lib/models';
import * as fs from 'fs';
import { BasicAuthenticationCredentials, HttpOperationResponse } from 'ms-rest';
import * as opn from 'opn';
// tslint:disable-next-line:no-require-imports
import request = require('request-promise'); // there is no default export
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { DeployResult } from 'vscode-azurekudu/lib/models';
import { DialogResponses } from './DialogResponses';
import { ArgumentError } from './errors';
import * as FileUtilities from './FileUtilities';
import { localize } from './localize';
import { nodeUtils } from './utils/nodeUtils';
import { IQuickPickItemWithData } from './wizard/IQuickPickItemWithData';

// Deployment sources supported by Web Apps
const SCM_TYPES: string[] = [
    'None', // default scmType config
    'LocalGit'];

export class SiteWrapper {
    public readonly resourceGroup: string;
    public readonly location: string;
    public readonly name: string;
    public readonly slotName?: string;
    public readonly planResourceGroup: string;
    public readonly planName: string;
    public readonly id: string;
    private readonly _gitUrl: string;

    constructor(site: Site) {
        const matches: RegExpMatchArray | null = site.serverFarmId.match(/\/subscriptions\/(.*)\/resourceGroups\/(.*)\/providers\/Microsoft.Web\/serverfarms\/(.*)/);
        if (!site.id || !site.name || !site.resourceGroup || !site.type || matches === null || matches.length < 4) {
            throw new ArgumentError(site);
        }

        const isSlot: boolean = site.type.toLowerCase() === 'microsoft.web/sites/slots';
        this.id = site.id;
        this.resourceGroup = site.resourceGroup;
        this.location = site.location;
        this.name = isSlot ? site.name.substring(0, site.name.lastIndexOf('/')) : site.name;
        this.slotName = isSlot ? site.name.substring(site.name.lastIndexOf('/') + 1) : undefined;
        // the scm url used for git repo is in index 1 of enabledHostNames, not 0
        this._gitUrl = `${site.enabledHostNames[1]}:443/${site.repositorySiteName}.git`;

        this.planResourceGroup = matches[2];
        this.planName = matches[3];
    }

    public get appName(): string {
        return this.name + (this.slotName ? `-${this.slotName}` : '');
    }

    public async stop(client: WebSiteManagementClient): Promise<void> {
        if (this.slotName) {
            await client.webApps.stopSlot(this.resourceGroup, this.name, this.slotName);
        } else {
            await client.webApps.stop(this.resourceGroup, this.name);
        }
    }

    public async start(client: WebSiteManagementClient): Promise<void> {
        if (this.slotName) {
            await client.webApps.startSlot(this.resourceGroup, this.name, this.slotName);
        } else {
            await client.webApps.start(this.resourceGroup, this.name);
        }
    }

    public async getState(client: WebSiteManagementClient): Promise<string | undefined> {
        const currentSite: Site = this.slotName ?
            await client.webApps.getSlot(this.resourceGroup, this.name, this.slotName) :
            await client.webApps.get(this.resourceGroup, this.name);

        return currentSite.state;
    }

    public async getWebAppPublishCredential(client: WebSiteManagementClient): Promise<User> {
        return this.slotName ?
            await client.webApps.listPublishingCredentialsSlot(this.resourceGroup, this.name, this.slotName) :
            await client.webApps.listPublishingCredentials(this.resourceGroup, this.name);
    }

    public async getSiteConfig(client: WebSiteManagementClient): Promise<SiteConfigResource> {
        return this.slotName ?
            await client.webApps.getConfigurationSlot(this.resourceGroup, this.name, this.slotName) :
            await client.webApps.getConfiguration(this.resourceGroup, this.name);
    }

    public async updateConfiguration(client: WebSiteManagementClient, config: SiteConfigResource): Promise<SiteConfigResource> {
        return this.slotName ?
            await client.webApps.updateConfigurationSlot(this.resourceGroup, this.name, config, this.slotName) :
            await client.webApps.updateConfiguration(this.resourceGroup, this.name, config);
    }

    public async getAppServicePlan(client: WebSiteManagementClient): Promise<AppServicePlan> {
        return await client.appServicePlans.get(this.planResourceGroup, this.planName);
    }

    public async deleteSite(client: WebSiteManagementClient, outputChannel: vscode.OutputChannel): Promise<void> {
        const confirmMessage: string = localize('deleteConfirmation', 'Are you sure you want to delete "{0}"?', this.appName);
        if (await vscode.window.showWarningMessage(confirmMessage, DialogResponses.yes, DialogResponses.cancel) !== DialogResponses.yes) {
            throw new UserCancelledError();
        }

        let plan: AppServicePlan | undefined;
        let deletePlan: boolean = false;

        if (!this.slotName) {
            // API calls not necessary for deployment slots
            plan = await this.getAppServicePlan(client);
        }

        if (!this.slotName && plan.numberOfSites < 2) {
            const message: string = localize('deleteLastServicePlan', 'This is the last app in the App Service plan "{0}". Do you want to delete this App Service plan to prevent unexpected charges?', plan.name);
            const input: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogResponses.yes, DialogResponses.no, DialogResponses.cancel);
            if (input === undefined) {
                throw new UserCancelledError();
            } else {
                deletePlan = input === DialogResponses.yes;
            }
        }

        outputChannel.show();
        outputChannel.appendLine(localize('Deleting', 'Deleting "{0}"...', this.appName));
        if (this.slotName) {
            await client.webApps.deleteSlot(this.resourceGroup, this.name, this.slotName);
        } else {
            await client.webApps.deleteMethod(this.resourceGroup, this.name, { deleteEmptyServerFarm: deletePlan });
        }
        outputChannel.appendLine(localize('DeleteSucceeded', 'Successfully deleted "{0}".', this.appName));
    }

    public async deploy(fsPath: string, client: WebSiteManagementClient, outputChannel: vscode.OutputChannel, configurationSectionName: string, confirmDeployment: boolean = true): Promise<void> {
        const config: SiteConfigResource = await this.getSiteConfig(client);
        switch (config.scmType) {
            case SCM_TYPES[1]: // 'LocalGit'
                await this.localGitDeploy(fsPath, client, outputChannel);
                break;
            default: //'None' or any other non-supported scmType
                await this.deployZip(fsPath, client, outputChannel, configurationSectionName, confirmDeployment);
                break;
        }

        outputChannel.appendLine(localize('deployComplete', '>>>>>> Deployment to "{0}" completed. <<<<<<', this.appName));
        outputChannel.appendLine('');
    }

    public async connectToGitHub(node: IAzureNode, outputChannel: vscode.OutputChannel): Promise<void> {

        type gitHubOrgData = { repos_url?: string };
        type gitHubReposData = { repos_url?: string, url?: string, html_url?: string };

        const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
        const oAuth2Token: string = (await client.listSourceControls())[0].token;
        if (!oAuth2Token) {
            this.showGitHubAuthPrompt(node);
            return;
        }

        const gitHubUser: Object[] = await this.getJsonRequest('https://api.github.com/user', oAuth2Token);

        const gitHubOrgs: Object[] = await this.getJsonRequest('https://api.github.com/user/orgs', oAuth2Token);
        const orgQuickPicks: IQuickPickItemWithData<{}>[] = this.createQuickPickFromJsons([gitHubUser], 'login', undefined, ['repos_url']).concat(this.createQuickPickFromJsons(gitHubOrgs, 'login', undefined, ['repos_url']));
        const orgQuickPick: gitHubOrgData = (await vscode.window.showQuickPick(orgQuickPicks, { placeHolder: 'Choose your organization.', ignoreFocusOut: true })).data;

        const gitHubRepos: Object[] = await this.getJsonRequest(orgQuickPick.repos_url, oAuth2Token);
        const repoQuickPicks: IQuickPickItemWithData<{}>[] = this.createQuickPickFromJsons(gitHubRepos, 'name', undefined, ['url', 'html_url']);
        const repoQuickPick: gitHubReposData = (await vscode.window.showQuickPick(repoQuickPicks, { placeHolder: 'Choose project.', ignoreFocusOut: true })).data;

        const gitHubBranches: Object[] = await this.getJsonRequest(`${repoQuickPick.url}/branches`, oAuth2Token);
        const branchQuickPicks: IQuickPickItemWithData<{}>[] = this.createQuickPickFromJsons(gitHubBranches, 'name');
        const branchQuickPick: IQuickPickItemWithData<{}> = await vscode.window.showQuickPick(branchQuickPicks, { placeHolder: 'Choose branch.', ignoreFocusOut: true });

        const siteSourceControl: SiteSourceControl = {
            location: this.location,
            repoUrl: repoQuickPick.html_url,
            branch: branchQuickPick.label,
            isManualIntegration: false,
            deploymentRollbackEnabled: true,
            isMercurial: false
        };
        this.log(outputChannel, 'Web app is being connected to GitHub repo.');
        let newSourceControl: HttpOperationResponse<SiteSourceControl | void>;
        try {
            newSourceControl = await client.webApps.createOrUpdateSourceControlWithHttpOperationResponse(this.resourceGroup, this.name, siteSourceControl);
            console.log(newSourceControl);
        } catch (err) {
            console.log('Starting sync');
            try {
                newSourceControl = await client.webApps.syncRepositoryWithHttpOperationResponse(this.resourceGroup, this.name);
                console.log(newSourceControl);
            } catch (error) {
                console.log(error);
            }
        } finally {
            this.log(outputChannel, 'Web app has been connected to GitHub repo.');
        }

        // await this.waitForDeploymentToComplete((await this.getKuduClient(client)), outputChannel, 50000);
    }

    public async isHttpLogsEnabled(client: WebSiteManagementClient): Promise<boolean> {
        const logsConfig: SiteLogsConfig = this.slotName ? await client.webApps.getDiagnosticLogsConfigurationSlot(this.resourceGroup, this.name, this.slotName) :
            await client.webApps.getDiagnosticLogsConfiguration(this.resourceGroup, this.name);
        return logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled;
    }

    public async enableHttpLogs(client: WebSiteManagementClient): Promise<void> {
        const logsConfig: SiteLogsConfig = {
            location: this.location,
            httpLogs: {
                fileSystem: {
                    enabled: true,
                    retentionInDays: 7,
                    retentionInMb: 35
                }
            }
        };

        if (this.slotName) {
            await client.webApps.updateDiagnosticLogsConfigSlot(this.resourceGroup, this.name, logsConfig, this.slotName);
        } else {
            await client.webApps.updateDiagnosticLogsConfig(this.resourceGroup, this.name, logsConfig);
        }
    }

    public async getKuduClient(client: WebSiteManagementClient): Promise<KuduClient> {
        const user: User = await this.getWebAppPublishCredential(client);
        if (!user.publishingUserName || !user.publishingPassword) {
            throw new ArgumentError(user);
        }

        const cred: BasicAuthenticationCredentials = new BasicAuthenticationCredentials(user.publishingUserName, user.publishingPassword);

        return new KuduClient(cred, `https://${this.appName}.scm.azurewebsites.net`);
    }

    public async editScmType(client: WebSiteManagementClient): Promise<string | undefined> {
        const config: SiteConfigResource = await this.getSiteConfig(client);
        const newScmType: string = await this.showScmPrompt(config.scmType);
        // returns the updated scmType
        return await this.updateScmType(client, config, newScmType);
    }

    private async deployZip(fsPath: string, client: WebSiteManagementClient, outputChannel: vscode.OutputChannel, configurationSectionName: string, confirmDeployment: boolean): Promise<void> {
        if (confirmDeployment) {
            const warning: string = localize('zipWarning', 'Are you sure you want to deploy to "{0}"? This will overwrite any previous deployment and cannot be undone.', this.appName);
            if (await vscode.window.showWarningMessage(warning, DialogResponses.yes, DialogResponses.cancel) !== DialogResponses.yes) {
                throw new UserCancelledError();
            }
        }

        outputChannel.show();
        const kuduClient: KuduClient = await this.getKuduClient(client);

        let zipFilePath: string;
        let createdZip: boolean = false;
        if (FileUtilities.getFileExtension(fsPath) === 'zip') {
            zipFilePath = fsPath;
        } else if (await FileUtilities.isDirectory(fsPath)) {
            createdZip = true;
            this.log(outputChannel, localize('zipCreate', 'Creating zip package...'));
            const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(configurationSectionName);
            // tslint:disable-next-line:no-backbone-get-set-outside-model
            const globPattern: string = zipDeployConfig.get<string>('zipGlobPattern');
            // tslint:disable-next-line:no-backbone-get-set-outside-model
            const ignorePattern: string = zipDeployConfig.get<string>('zipIgnorePattern');

            zipFilePath = await FileUtilities.zipDirectory(fsPath, globPattern, ignorePattern);
        } else {
            throw new Error(localize('NotAZipError', 'Path specified is not a folder or a zip file'));
        }

        try {
            this.log(outputChannel, localize('deployStart', 'Starting deployment...'));
            await kuduClient.pushDeployment.zipPushDeploy(fs.createReadStream(zipFilePath), { isAsync: true });
            await this.waitForDeploymentToComplete(kuduClient, outputChannel);
        } catch (error) {
            // tslint:disable-next-line:no-unsafe-any
            if (error && error.response && error.response.body) {
                // Autorest doesn't support plain/text as a MIME type, so we have to get the error message from the response body ourselves
                // https://github.com/Azure/autorest/issues/1527
                // tslint:disable-next-line:no-unsafe-any
                throw new Error(error.response.body);
            } else {
                throw error;
            }
        } finally {
            if (createdZip) {
                await FileUtilities.deleteFile(zipFilePath);
            }
        }
    }

    private async localGitDeploy(fsPath: string, client: WebSiteManagementClient, outputChannel: vscode.OutputChannel): Promise<void> {
        const kuduClient: KuduClient = await this.getKuduClient(client);
        const pushReject: string = localize('localGitPush', 'Push rejected due to Git history diverging. Force push?');
        const publishCredentials: User = await this.getWebAppPublishCredential(client);

        // credentials for accessing Azure Remote Repo
        const username: string = publishCredentials.publishingUserName;
        const password: string = publishCredentials.publishingPassword;
        const remote: string = `https://${username}:${password}@${this._gitUrl}`;
        const localGit: git.SimpleGit = git(fsPath);
        try {
            const status: git.StatusResult = await localGit.status();
            if (status.files.length > 0) {
                const uncommit: string = localize('localGitUncommit', '{0} uncommitted change(s) in local repo "{1}"', status.files.length, fsPath);
                vscode.window.showWarningMessage(uncommit);
            }
            await localGit.push(remote, 'HEAD:master');
        } catch (err) {
            // tslint:disable-next-line:no-unsafe-any
            if (err.message.indexOf('spawn git ENOENT') >= 0) {
                await this.showInstallPrompt();
                return undefined;
            } else if (err.message.indexOf('error: failed to push') >= 0) { // tslint:disable-line:no-unsafe-any
                const input: vscode.MessageItem | undefined = await vscode.window.showErrorMessage(pushReject, DialogResponses.yes, DialogResponses.cancel);
                if (input === DialogResponses.yes) {
                    await (<(remote: string, branch: string, options: object) => Promise<void>>localGit.push)(remote, 'HEAD:master', { '-f': true });
                    // Ugly casting neccessary due to bug in simple-git. Issue filed:
                    // https://github.com/steveukx/git-js/issues/218
                } else {
                    throw new UserCancelledError();
                }
            } else {
                throw err;
            }
        }

        outputChannel.show();
        this.log(outputChannel, (localize('localGitDeploy', `Deploying Local Git repository to "${this.appName}"...`)));
        await this.waitForDeploymentToComplete(kuduClient, outputChannel);
    }

    private async getJsonRequest(url: string, token: string): Promise<Object[]> {
        // Reference for GitHub REST routes
        // https://developer.github.com/v3/
        // Note: blank after user implies look up authorized user

        const gitHubResponse: string = await request.get(url, {
            headers: {
                Authorization: `token ${token}`,
                'User-Agent': 'vscode-azureappservice-extension'
            }
        });

        return JSON.parse(gitHubResponse);
    }

    /**
     * @param label Property of JSON that will be used as the QuickPicks label
     * @param description Optional property of JSON that will be used as QuickPicks description
     * @param description Optional property of JSON that will be used as QuickPicks data saved as a NameValue pair
     */
    private createQuickPickFromJsons(jsons: Object[], label: string, description?: string, data?: string[]): IQuickPickItemWithData<{}>[] {
        const quickPicks: IQuickPickItemWithData<{}>[] = [];
        for (const json of jsons) {
            const dataValuePair: NameValuePair = {};

            if (!json[label]) {
                // skip if this JSON does not have this label
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
                label: json[label],
                description: `${description ? json[description] : ''}`,
                data: dataValuePair
            });
        }

        return quickPicks;
    }

    private async showScmPrompt(currentScmType: string): Promise<string> {
        const placeHolder: string = localize('scmPrompt', 'Select a new source.');
        const currentSource: string = localize('currentSource', '(Current source)');
        const scmQuickPicks: vscode.QuickPickItem[] = [];
        // generate quickPicks to not include current type
        for (const scmQuickPick of SCM_TYPES) {
            if (scmQuickPick === currentScmType) {
                // put the current source at the top of the list
                scmQuickPicks.unshift({ label: scmQuickPick, description: currentSource });
            } else {
                scmQuickPicks.push({ label: scmQuickPick, description: '' });
            }
        }

        const quickPick: vscode.QuickPickItem = await vscode.window.showQuickPick(scmQuickPicks, { placeHolder: placeHolder });
        if (quickPick === undefined || quickPick.description === currentSource) {
            // if the user clicks the current source, treat it as a cancel
            throw new UserCancelledError();
        } else {
            return quickPick.label;
        }
    }

    private async waitForDeploymentToComplete(kuduClient: KuduClient, outputChannel: vscode.OutputChannel, pollingInterval: number = 5000): Promise<DeployResult> {
        // Unfortunately, Kudu doesn't provide a unique id for a deployment right after it's started
        // However, Kudu only supports one deployment at a time, so 'latest' will work in most cases
        let deploymentId: string = 'latest';
        const deployments: {} = await kuduClient.deployment.getDeployResults();
        console.log(deployments);

        let deployment: DeployResult = await kuduClient.deployment.getResult(deploymentId);
        while (!deployment.complete) {
            if (!deployment.isTemp && deployment.id) {
                // Switch from 'latest' to the permanent/unique id as soon as it's available
                deploymentId = deployment.id;
            }

            if (deployment.progress) {
                this.log(outputChannel, deployment.progress);
            }

            await new Promise((resolve: () => void): void => { setTimeout(resolve, pollingInterval); });
            deployment = await kuduClient.deployment.getResult(deploymentId);
        }

        return deployment;
    }

    private log(outputChannel: vscode.OutputChannel, message: string): void {
        outputChannel.appendLine(`${(new Date()).toLocaleTimeString()} ${this.appName}: ${message}`);
    }

    private async updateScmType(client: WebSiteManagementClient, config: SiteConfigResource, scmType: string): Promise<string | undefined> {
        config.scmType = scmType;
        // to update one property, a complete config file must be sent
        const newConfig: SiteConfigResource = await this.updateConfiguration(client, config);
        return newConfig.scmType;
    }

    private async showInstallPrompt(): Promise<void> {
        const installString: string = localize('Install', 'Install');
        const input: string | undefined = await vscode.window.showErrorMessage(localize('GitRequired', 'Git must be installed to use Local Git Deploy.'), installString);
        if (input === installString) {
            // tslint:disable-next-line:no-unsafe-any
            opn('https://git-scm.com/downloads');
        }
    }

    private async showGitHubAuthPrompt(node: IAzureNode): Promise<void> {
        const authorizeAzure: string = localize('gitHubNotAuth', 'Authorize');
        const setupGithub: string = localize('GitRequired', 'Azure must be authorized on GitHub under Deployment Options.');
        const input: string | undefined = await vscode.window.showErrorMessage(setupGithub, authorizeAzure);
        if (input === authorizeAzure) {
            node.openInPortal();
        }
    }
}
