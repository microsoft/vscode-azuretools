/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, isAzExtTreeItem, ISubscriptionContext, openUrl } from '@microsoft/vscode-azext-utils';

export type OpenInPortalOptions = {
    /**
     * A query string applied directly to the host URL, e.g. "feature.staticwebsites=true" (turns on a preview feature)
     */
    queryPrefix?: string;
};

/**
 * Combines the root.environment.portalLink and id to open the resource in the portal.
 *
 * NOTE: If root is a tree item, it will find the subscription ancestor and get environment.portalLink from there
 */
export async function openInPortal(root: ISubscriptionContext | AzExtTreeItem, id: string, options?: OpenInPortalOptions): Promise<void> {
    root = isAzExtTreeItem(root) ? root.subscription : root;

    const queryPrefix: string = (options?.queryPrefix) ? `?${options.queryPrefix}` : '';
    const url: string = `${root.environment.portalUrl}/${queryPrefix}#@${root.tenantId}/resource${id}`;

    await openUrl(url);
}
