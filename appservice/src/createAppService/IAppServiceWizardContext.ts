/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import { AppServicePlan, Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { AppKind, WebsiteOS } from './AppKind';

export interface IAppServiceWizardContext {
    appKind: AppKind;
    websiteOS: WebsiteOS;
    credentials: ServiceClientCredentials;
    subscription: Subscription;

    resourceGroup?: ResourceGroup;

    site?: Site;
    websiteName?: string;
    relatedNameTask?: Promise<string>;
    plan?: AppServicePlan | undefined;

    storageAccount?: StorageAccount;
    storageResourceGroup?: string;
    createNewStorageAccount?: boolean;
}
