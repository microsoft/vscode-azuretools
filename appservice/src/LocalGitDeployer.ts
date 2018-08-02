/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { SubscriptionModels, ResourceManagementClient, ResourceModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';

 export class LocalGitDeploter {
    // properties that I will need for the constructor
    // Service Plan Size: string
    // WebSiteManagementClient
    // either the workspaceFolder obj or add showWorkspaceFoldersQuickPick functionality
    // check if it is slot? parameter?
    // 
    private readonly _webSiteClient: WebSiteManagementClient;
    private readonly _site: WebSiteModels.Site;
    private readonly _servicePlan: WebSiteModels.AppServicePlan;


    
}