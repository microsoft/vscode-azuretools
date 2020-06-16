/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { SiteConfigResource, SiteSourceControl, User } from 'azure-arm-website/lib/models';
import KuduClient from 'vscode-azurekudu';
import { IAppSettingsClient } from './IAppSettingsClient';
import { IHostKeys } from './SiteClient';

export interface ISimplifiedSiteClient extends IAppSettingsClient {
    defaultHostUrl: string;
    isFunctionApp: boolean;
    id: string;
    kuduUrl: string | undefined;
    gitUrl: string | undefined;
    getKuduClient(): Promise<KuduClient>;
    listHostKeys?(): Promise<IHostKeys>;
    getSiteConfig(): Promise<SiteConfigResource>;
    getSourceControl(): Promise<SiteSourceControl>;
    getWebAppPublishCredential(): Promise<User>;
}
