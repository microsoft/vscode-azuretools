/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { Memento, OutputChannel } from 'vscode';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServiceCreator } from './AppServiceCreator';

export async function createWebApp(outputChannel: OutputChannel, persistence: Memento, credentials?: ServiceClientCredentials, subscription?: Subscription, showCreatingNode?: (label: string) => void): Promise<Site | undefined> {
    const creator: AppServiceCreator = new AppServiceCreator(outputChannel, persistence, AppKind.app, WebsiteOS.linux, credentials, subscription);
    await creator.prompt();
    if (showCreatingNode) {
        showCreatingNode(creator.websiteNameStep.websiteName);
    }
    await creator.execute();
    return creator.siteStep.site;
}
