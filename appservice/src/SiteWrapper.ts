/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from 'azure-arm-website/lib/models';
import * as fs from 'fs';
import { BasicAuthenticationCredentials } from 'ms-rest';
import * as vscode from 'vscode';
import KuduClient from 'vscode-azurekudu';
import * as KuduModels from 'vscode-azurekudu/lib/models';
import * as FileUtilities from './FileUtilities';

export class SiteWrapper {
    public readonly resourceGroup: string;
    public readonly name: string;
    public readonly slotName?: string;

    constructor(site: WebSiteModels.Site) {
        if (!site.name || !site.resourceGroup || !site.type) {
            throw new Error('Invalid site.');
        }

        const isSlot: boolean = site.type.toLowerCase() === 'microsoft.web/sites/slots';
        this.resourceGroup = site.resourceGroup;
        this.name = isSlot ? site.name.substring(0, site.name.lastIndexOf('/')) : site.name;
        this.slotName = isSlot ? site.name.substring(site.name.lastIndexOf('/') + 1) : undefined;
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
        const currentSite: WebSiteModels.Site = this.slotName ?
            await client.webApps.getSlot(this.resourceGroup, this.name, this.slotName) :
            await client.webApps.get(this.resourceGroup, this.name);

        return currentSite.state;
    }

    public async getWebAppPublishCredential(client: WebSiteManagementClient): Promise<WebSiteModels.User> {
        return this.slotName ?
            await client.webApps.listPublishingCredentialsSlot(this.resourceGroup, this.name, this.slotName) :
            await client.webApps.listPublishingCredentials(this.resourceGroup, this.name);
    }

    public async getSiteConfig(client: WebSiteManagementClient): Promise<WebSiteModels.SiteConfig> {
        return this.slotName ?
            await client.webApps.getConfigurationSlot(this.resourceGroup, this.name, this.slotName) :
            await client.webApps.getConfiguration(this.resourceGroup, this.name);
    }

    public async deployZip(fsPath: string, client: WebSiteManagementClient, outputChannel: vscode.OutputChannel): Promise<void> {
        outputChannel.show();
        outputChannel.appendLine(`Starting deployment to '${this.appName}'...`);
        const kuduClient: KuduClient = await this.getKuduClient(client);

        let zipFilePath: string;
        let createdZip: boolean = false;
        if (FileUtilities.getFileExtension(fsPath) === 'zip') {
            zipFilePath = fsPath;
        } else if (await FileUtilities.isDirectory(fsPath)) {
            createdZip = true;
            outputChannel.appendLine('Creating zip package...');
            zipFilePath = await FileUtilities.zipDirectory(fsPath);
        } else {
            throw new Error('Path specified is not a folder or a zip file');
        }

        try {
            outputChannel.appendLine('Stopping Web App...');
            await this.stop(client);

            outputChannel.appendLine('Deleting existing deployment...');
            await this.executeCommand(kuduClient, outputChannel, 'rm -rf wwwroot', '/home/site/');
            outputChannel.appendLine('Uploading Zip package...');
            const fileStream: fs.ReadStream = fs.createReadStream(zipFilePath);
            await kuduClient.zip.putItem(fileStream, 'site/wwwroot/');
        } finally {
            if (createdZip) {
                await FileUtilities.deleteFile(zipFilePath);
            }
        }

        const siteConfig: WebSiteModels.SiteConfig = await this.getSiteConfig(client);
        if (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.startsWith('node')) {
            outputChannel.appendLine('Installing npm packages...');
            await this.executeCommand(kuduClient, outputChannel, 'npm install --production', '/home/site/wwwroot/');
        }

        outputChannel.appendLine('Starting Web App...');
        await this.start(client);
        outputChannel.appendLine(`Deployment to '${this.appName}' completed.`);
    }

    private async executeCommand(kuduClient: KuduClient, outputChannel: vscode.OutputChannel, command: string, workingDir: string = '/'): Promise<void> {
        const result: KuduModels.CommandResult = await kuduClient.command.executeCommand({ command: command, dir: workingDir });
        if (result.exitCode !== 0) {
            throw new Error(result.error);
        } else if (result.output) {
            outputChannel.appendLine(result.output);
        }
    }

    private async getKuduClient(client: WebSiteManagementClient): Promise<KuduClient> {
        const user: WebSiteModels.User = await this.getWebAppPublishCredential(client);
        if (!user.publishingUserName || !user.publishingPassword) {
            throw new Error('Invalid publishing credentials.');
        }

        const cred: BasicAuthenticationCredentials = new BasicAuthenticationCredentials(user.publishingUserName, user.publishingPassword);

        return new KuduClient(cred, `https://${this.appName}.scm.azurewebsites.net`);
    }
}
