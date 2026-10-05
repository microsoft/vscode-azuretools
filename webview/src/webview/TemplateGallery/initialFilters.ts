/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type FilterState, type InitialTemplateFilters } from './types';

export function createInitialFilters(initialFilters?: InitialTemplateFilters): FilterState {
    return {
        language: 'all',
        useCase: 'all',
        resource: 'all',
        search: '',
        ...initialFilters,
    };
}
