/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import { l10n } from "vscode";

export const gitHubAuthProviderId: string = 'github';

// Provide same scopes as the GitHub extension so we don't have to prompt for auth again
export const gitHubScopes: string[] = ['repo', 'workflow', 'user:email', 'read:user'];

export const loadMoreQp: IAzureQuickPickItem = { label: l10n.t('$(sync) Load More'), data: undefined, suppressPersistence: true };
