/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum WebsiteOS {
    linux = 'linux',
    windows = 'windows'
}

export enum AppKind {
    app = 'app',
    functionapp = 'functionapp',
    workflowapp = 'functionapp,workflowapp'
}

/**
 * Retrieves a valid "kind" for AppServicePlan
 */
export function getAppServicePlanModelKind(_kind: AppKind, os: WebsiteOS): string {
    // Always create app plans, no matter what the website kind
    if (os === WebsiteOS.linux) {
        return WebsiteOS.linux;
    } else {
        return AppKind.app;
    }
}

export function getWebsiteOSDisplayName(kind: WebsiteOS): string {
    switch (kind) {
        case WebsiteOS.windows:
            return 'Windows';
        case WebsiteOS.linux:
            return 'Linux';
        default:
            throw new RangeError();
    }
}
