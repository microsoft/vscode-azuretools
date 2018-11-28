/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { localize } from '../localize';

export const loadingIconPath: { light: string, dark: string } = {
    // tslint:disable-next-line:no-require-imports
    light: path.join(__dirname, require('../../../resources/light/Loading.svg')),
    // tslint:disable-next-line:no-require-imports
    dark: path.join(__dirname, require('../../../resources/dark/Loading.svg'))
};

export const loadMoreLabel: string = localize('LoadMore', 'Load More...');
