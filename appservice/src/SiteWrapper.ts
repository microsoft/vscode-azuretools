/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { Site, SiteConfig, SiteConfigResource, User } from 'azure-arm-website/lib/models';
import * as fs from 'fs';
import { BasicAuthenticationCredentials } from 'ms-rest';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import KuduClient from 'vscode-azurekudu';
import { DeployResult } from 'vscode-azurekudu/lib/models';
import * as errors from './errors';
import * as FileUtilities from './FileUtilities';
import { localize } from './localize';

export class SiteWrapper {
    public readonly resourceGroup: string;
    public readonly name: string;
    public readonly slotName?: string;
    private readonly _gitUrl: string;

    constructor(site: Site) {
        if (!site.name || !site.resourceGroup || !site.type) {
            throw new errors.ArgumentError(site);
        }

        const isSlot: boolean = site.type.toLowerCase() === 'microsoft.web/sites/slots';
        this.resourceGroup = site.resourceGroup;
        this.name = isSlot ? site.name.substring(0, site.name.lastIndexOf('/')) : site.name;
        this.slotName = isSlot ? site.name.substring(site.name.lastIndexOf('/') + 1) : undefined;
        // the scm url used for git repo is in index 1 of enabledHostNames, not 0
        this._gitUrl = `${site.enabledHostNames[1]}:443/${site.repositorySiteName}.git`;
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

    public async getSiteConfig(client: WebSiteManagementClient): Promise<SiteConfig> {
        return this.slotName ?
            await client.webApps.getConfigurationSlot(this.resourceGroup, this.name, this.slotName) :
            await client.webApps.getConfiguration(this.resourceGroup, this.name);
    }

    public async deployZip(fsPath: string, client: WebSiteManagementClient, outputChannel: vscode.OutputChannel): Promise<void> {
        const yes: string = 'Yes';
        const warning: string = `Are you sure you want to deploy to "${this.appName}"? This will overwrite any previous deployment and cannot be undone.`;
        if (await vscode.window.showWarningMessage(warning, yes) !== yes) {
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

    public async localGitDeploy(fsPath: string, client: WebSiteManagementClient, outputChannel: vscode.OutputChannel, servicePlan: string): Promise<void> {
        vscode.window.showInformationMessage('It updated to 2.2');
        let taskResults: [User, SiteConfigResource];
        const kuduClient: KuduClient = await this.getKuduClient(client);
        const yes: string = 'Yes';
        const pushReject: string = 'Push rejected due to Git history diverging. Force push?';

        if (!this.slotName) {
            // API calls for Web App
            taskResults = await Promise.all([
                client.webApps.listPublishingCredentials(this.resourceGroup, this.appName),
                client.webApps.getConfiguration(this.resourceGroup, this.appName)
            ]);
        } else {
            // API calls for Deployment Slot
            taskResults = await Promise.all([
                client.webApps.listPublishingCredentialsSlot(this.resourceGroup, this.appName, this.slotName),
                client.webApps.getConfigurationSlot(this.resourceGroup, this.appName, this.slotName)
            ]);
        }

        const publishCredentials: User = taskResults[0];
        const config: SiteConfigResource = taskResults[1];
        if (config.scmType !== 'LocalGit') {
            // SCM must be set to LocalGit prior to deployment
            await this.updateScmType(client, config);
        }
        // credentials for accessing Azure Remote Repo
        const username: string = publishCredentials.publishingUserName;
        const password: string = publishCredentials.publishingPassword;
        const remote: string = `https://${username}:${password}@${this._gitUrl}`;
        const localGit: git.SimpleGit = git(fsPath);
        try {

            const status: git.StatusResult = await localGit.status();
            if (status.files.length > 0) {
                const uncommit: string = `${status.files.length} uncommitted change(s) in local repo "${fsPath}"`;
                vscode.window.showWarningMessage(uncommit);
            }
            await localGit.push(remote, 'HEAD:master');
        } catch (err) {
            // tslint:disable-next-line:no-unsafe-any
            if (err.message.indexOf('spawn git ENOENT') >= 0) {
                throw new errors.GitNotInstalledError();
            } else if (err.message.indexOf('error: failed to push') >= 0) { // tslint:disable-line:no-unsafe-any
                const input: string | undefined = await vscode.window.showErrorMessage(pushReject, yes);
                if (input === 'Yes') {
                    await (<(a: string, b: string, c: object) => Promise<void>>localGit.push)(remote, 'HEAD:master', { '-f': true });
                    // Ugly casting neccessary due to bug in simple-git. Issue filed
                } else {
                    throw new errors.UserCancelledError();
                }
            } else {
                // tslint:disable-next-line:no-unsafe-any
                throw new errors.LocalGitDeployError(err, servicePlan);
            }
        }

        await this.waitForDeploymentToComplete(kuduClient, outputChannel);
    }

    private async waitForDeploymentToComplete(kuduClient: KuduClient, outputChannel: vscode.OutputChannel, pollingInterval: number = 5000): Promise<void> {
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
    }

    private log(outputChannel: vscode.OutputChannel, message: string): void {
        outputChannel.appendLine(`${(new Date()).toLocaleTimeString()} ${this.appName}: ${message}`);
    }

    private async getKuduClient(client: WebSiteManagementClient): Promise<KuduClient> {
        const user: User = await this.getWebAppPublishCredential(client);
        if (!user.publishingUserName || !user.publishingPassword) {
            throw new errors.ArgumentError(user);
        }

        const cred: BasicAuthenticationCredentials = new BasicAuthenticationCredentials(user.publishingUserName, user.publishingPassword);

        return new KuduClient(cred, `https://${this.appName}.scm.azurewebsites.net`);
    }

    private async updateScmType(client: WebSiteManagementClient, config: SiteConfigResource): Promise<void> {
        const oldScmType: string = config.scmType;
        const updateScm: string = `Deployment source for "${this.appName}" is set as "${oldScmType}".  Change to "LocalGit"?`;
        const yes: string = 'Yes';
        let input: string | undefined;

        const updateConfig: SiteConfigResource = config;
        updateConfig.scmType = 'LocalGit';
        // to update one property, a complete config file must be sent
        input = await vscode.window.showWarningMessage(updateScm, yes);
        if (input === 'Yes') {
            !this.slotName ?
                await client.webApps.updateConfiguration(this.resourceGroup, this.appName, updateConfig) :
                await client.webApps.updateConfigurationSlot(this.resourceGroup, this.appName, updateConfig, this.slotName);
        } else {
            throw new errors.UserCancelledError();
        }
    }
}
