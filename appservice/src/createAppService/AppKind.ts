/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from "../localize";

export enum WebsiteOS {
    linux = 'linux',
    windows = 'windows'
}

export enum AppKind {
    app = 'app',
    functionapp = 'functionapp'
}

export enum LinuxRuntimes {
    node = 'node',
    python = 'python'
}

/**
 * Retrieves a valid "kind" for Site
 */
export function getSiteModelKind(kind: AppKind, os: WebsiteOS): string {
    let planKind: string;

    if (os === WebsiteOS.linux) {
        return `${kind},${WebsiteOS.linux}`;
    } else {
        // "app" or "functionapp"
        planKind = kind;
    }

    return planKind;
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

export function getAppKindDisplayName(kind: AppKind): string {
    switch (kind) {
        case AppKind.app:
            return localize('WebApp', "Web App");
        case AppKind.functionapp:
            return localize('FunctionApp', "Function App");
        default:
            throw new RangeError();
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
