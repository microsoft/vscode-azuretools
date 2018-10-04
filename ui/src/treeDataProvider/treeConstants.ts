/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { localize } from '../localize';

export const loadingIconPath: { light: string, dark: string } = {
    light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Loading.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Loading.svg')
};

export const loadMoreLabel: string = localize('LoadMore', 'Load More...');
