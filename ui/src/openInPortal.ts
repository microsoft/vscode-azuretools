/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../index';
import { openUrl } from "./utils/openUrl";

export async function openInPortal(root: types.ISubscriptionContext, id: string, options?: types.OpenInPortalOptions): Promise<void> {
    const queryPrefix: string = (options && options.queryPrefix) ? `?${options.queryPrefix}` : '';
    const url: string = `${root.environment.portalUrl}/${queryPrefix}#@${root.tenantId}/resource${id}`;

    await openUrl(url);
}
