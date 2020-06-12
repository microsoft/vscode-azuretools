/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { SiteConfigResource, SiteSourceControl, StringDictionary, User } from 'azure-arm-website/lib/models';
import { KuduClient } from 'vscode-azurekudu';

export interface IDeploymentsClient {

    fullName: string;
    isFunctionApp: boolean;
    isLinux: boolean;
    gitUrl: string | undefined;
    listApplicationSettings(): Promise<StringDictionary>;
    updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary>;
    getKuduClient(): Promise<KuduClient>;
    getSiteConfig(): Promise<SiteConfigResource>;
    getSourceControl(): Promise<SiteSourceControl>;
    getWebAppPublishCredential(): Promise<User>;
}
