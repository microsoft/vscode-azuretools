/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { KuduClient } from 'vscode-azurekudu';
import { IAppSettingsClient } from './appSettings/IAppSettingsClient';

export interface ISimplifiedSiteClient extends IAppSettingsClient {
    defaultHostUrl: string;
    isFunctionApp: boolean;
    id: string;
    kuduUrl: string | undefined;
    gitUrl: string | undefined;
    getKuduClient(): Promise<KuduClient>;
    getSiteConfig(): Promise<WebSiteManagementModels.SiteConfigResource>;
    getSourceControl(): Promise<WebSiteManagementModels.SiteSourceControl>;
    getWebAppPublishCredential(): Promise<WebSiteManagementModels.User>;
    listHostKeys?(): Promise<WebSiteManagementModels.HostKeys>;
}
