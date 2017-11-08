/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { Memento, OutputChannel } from 'vscode';
import { UserCancelledError } from '../errors';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServiceCreator } from './AppServiceCreator';

export async function createWebApp(outputChannel: OutputChannel, persistence: Memento, credentials?: ServiceClientCredentials, subscription?: Subscription): Promise<Site | undefined> {
    const creator: AppServiceCreator = new AppServiceCreator(outputChannel, persistence, AppKind.app, WebsiteOS.linux, credentials, subscription);
    try {
        await creator.run();
        return creator.siteStep.site;
    } catch (error) {
        if (error instanceof UserCancelledError) {
            // Return undefined rather than exposing UserCancelledError in index.ts contract
            return undefined;
        } else {
            throw error;
        }
    }
}
