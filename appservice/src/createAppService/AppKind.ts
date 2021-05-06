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
    workflowapp = 'workflowapp'
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
