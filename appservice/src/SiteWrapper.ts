/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { AppServicePlan, Site, SiteConfigResource, User } from 'azure-arm-website/lib/models';
import * as fs from 'fs';
import { BasicAuthenticationCredentials } from 'ms-rest';
import * as opn from 'opn';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import KuduClient from 'vscode-azurekudu';
import { DeployResult } from 'vscode-azurekudu/lib/models';
import { ArgumentError } from './errors';
import * as FileUtilities from './FileUtilities';
import { localize } from './localize';

const noSupport: string = localize('noSupport', 'This deployment source is not currently supported and will be deployed by zip.');
// Deployment sources supported by Web Apps
const SCM_TYPES: vscode.QuickPickItem[] = [
    { label: 'None', description: ''}, // default scmType config
    { label: 'LocalGit', description: ''},
    { label: 'GitHub', description: noSupport }, // not yet supported by extension-- default to "Zip Deploy"
    { label: 'BitbucketGit', description: noSupport } // not yet supported by extension-- default to "Zip Deploy"
];

export class SiteWrapper {
    public readonly resourceGroup: string;
    public readonly name: string;
    public readonly slotName?: string;
    public readonly planResourceGroup: string;
    public readonly planName: string;
    private readonly _gitUrl: string;

    private readonly _yes: string = localize('Yes', 'Yes');
    private readonly _no: string = localize('No', 'No');

    constructor(site: Site) {
        const matches: RegExpMatchArray | null = site.serverFarmId.match(/\/subscriptions\/(.*)\/resourceGroups\/(.*)\/providers\/Microsoft.Web\/serverfarms\/(.*)/);
        if (!site.name || !site.resourceGroup || !site.type || matches === null || matches.length < 4) {
            throw new ArgumentError(site);
        }

        const isSlot: boolean = site.type.toLowerCase() === 'microsoft.web/sites/slots';
        this.resourceGroup = site.resourceGroup;
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
            await client.webApps.updateConfigurationSlot(this.resourceGroup, this.appName, config, this.slotName) :
            await client.webApps.updateConfiguration(this.resourceGroup, this.appName, config);
    }

    public async getAppServicePlan(client: WebSiteManagementClient): Promise<AppServicePlan> {
        return await client.appServicePlans.get(this.planResourceGroup, this.planName);
    }

    public async deleteSite(client: WebSiteManagementClient, outputChannel: vscode.OutputChannel): Promise<void> {
        const confirmMessage: string = localize('deleteConfirmation', 'Are you sure you want to delete "{0}"?', this.appName);
        if (await vscode.window.showWarningMessage(confirmMessage, this._yes) !== this._yes) {
            return;
        }

        let plan: AppServicePlan | undefined;
        let deletePlan: boolean = false;

        if (!this.slotName) {
            // API calls not necessary for deployment slots
            plan = await this.getAppServicePlan(client);
        }

        if (!this.slotName && plan.numberOfSites < 2) {
            const message: string = localize('deleteLastServicePlan', 'This is the last app in the App Service plan "{0}". Do you want to delete this App Service plan to prevent unexpected charges?', plan.name);
            const input: string | undefined = await vscode.window.showWarningMessage(message, this._yes, this._no);
            if (input === undefined) {
                return;
            } else {
                deletePlan = input === this._yes;
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

    public async deployZip(fsPath: string, client: WebSiteManagementClient, outputChannel: vscode.OutputChannel): Promise<void> {
        const warning: string = localize('zipWarning', 'Are you sure you want to deploy to "{0}"? This will overwrite any previous deployment and cannot be undone.', this.appName);
        if (await vscode.window.showWarningMessage(warning, this._yes) !== this._yes) {
            return;
        }

        outputChannel.show();
        const kuduClient: KuduClient = await this.getKuduClient(client);

        let zipFilePath: string;
        let createdZip: boolean = false;
        if (FileUtilities.getFileExtension(fsPath) === 'zip') {
            zipFilePath = fsPath;
        } else if (await FileUtilities.isDirectory(fsPath)) {
            createdZip = true;
            this.log(outputChannel, 'Creating zip package...');
            zipFilePath = await FileUtilities.zipDirectory(fsPath);
        } else {
            throw new Error(localize('NotAZipError', 'Path specified is not a folder or a zip file'));
        }

        try {
            this.log(outputChannel, 'Starting deployment...');
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

        this.log(outputChannel, 'Deployment completed.');
    }

    public async localGitDeploy(fsPath: string, client: WebSiteManagementClient, outputChannel: vscode.OutputChannel): Promise<DeployResult | undefined> {
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
                const input: string | undefined = await vscode.window.showErrorMessage(pushReject, this._yes);
                if (input === this._yes) {
                    await (<(remote: string, branch: string, options: object) => Promise<void>>localGit.push)(remote, 'HEAD:master', { '-f': true });
                    // Ugly casting neccessary due to bug in simple-git. Issue filed:
                    // https://github.com/steveukx/git-js/issues/218
                } else {
                    return undefined;
                }
            } else {
                throw err;
            }
        }
        return await this.waitForDeploymentToComplete(kuduClient, outputChannel);
    }

    public async editScmType(client: WebSiteManagementClient): Promise<string> {
        const config: SiteConfigResource = await this.getSiteConfig(client);
        const newScmType: string = await this.showScmPrompt(config.scmType);
        // returns the updated scmType
        return await this.updateScmType(client, config, newScmType);
    }

    private async showScmPrompt(currentScmType: string): Promise<string> {
        const placeHolder: string = localize('scmPrompt', 'Current ScmType is "{0}".  Select a new deployment source.', currentScmType);
        const scmQuickPicks: vscode.QuickPickItem[] = [];
        // generate quickPicks to not include current type
        for (const scmQuickPick of SCM_TYPES) {
            if (scmQuickPick.label !== currentScmType) {
                scmQuickPicks.push(scmQuickPick);
            }
        }

        const quickPick: vscode.QuickPickItem = await vscode.window.showQuickPick(scmQuickPicks, { placeHolder: placeHolder });
        return quickPick.label;
    }

    private async waitForDeploymentToComplete(kuduClient: KuduClient, outputChannel: vscode.OutputChannel, pollingInterval: number = 5000): Promise<DeployResult> {
        // Unfortunately, Kudu doesn't provide a unique id for a deployment right after it's started
        // However, Kudu only supports one deployment at a time, so 'latest' will work in most cases
        let deploymentId: string = 'latest';
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

    private async getKuduClient(client: WebSiteManagementClient): Promise<KuduClient> {
        const user: User = await this.getWebAppPublishCredential(client);
        if (!user.publishingUserName || !user.publishingPassword) {
            throw new ArgumentError(user);
        }

        const cred: BasicAuthenticationCredentials = new BasicAuthenticationCredentials(user.publishingUserName, user.publishingPassword);

        return new KuduClient(cred, `https://${this.appName}.scm.azurewebsites.net`);
    }

    private async updateScmType(client: WebSiteManagementClient, config: SiteConfigResource, scmType: string): Promise<string | undefined> {
        config.scmType = scmType;
        // to update one property, a complete config file must be sent
        const newConfig: SiteConfigResource = await this.updateConfiguration(client, config);
        return newConfig.scmType;
    }

    private async showInstallPrompt(): Promise<void> {
        const installString: string = 'Install';
        const input: string | undefined = await vscode.window.showErrorMessage('Git must be installed to use Local Git Deploy.', installString);
        if (input === installString) {
            // tslint:disable-next-line:no-unsafe-any
            opn('https://git-scm.com/downloads');
        }
    }
}
