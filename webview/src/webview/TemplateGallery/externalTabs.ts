/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TemplateGalleryExternalTab } from './types';

const builtInTabIds = new Set(['browse', 'ai']);

/** Drops external tabs that would collide with built-in or earlier tab ids. */
export function getValidExternalTabs(tabs: TemplateGalleryExternalTab[] | undefined): TemplateGalleryExternalTab[] {
    const seen = new Set<string>();
    return (tabs ?? []).filter(tab => {
        if (!tab.id || builtInTabIds.has(tab.id) || seen.has(tab.id)) {
            return false;
        }
        seen.add(tab.id);
        return true;
    });
}

export function findExternalTabById(tabs: TemplateGalleryExternalTab[], id: string): TemplateGalleryExternalTab | undefined {
    return tabs.find(tab => tab.id === id);
}

/** Returns the external tab that owns a use-case filter value, if any. "all" is never owned. */
export function findExternalTabForUseCase(tabs: TemplateGalleryExternalTab[], useCase: string): TemplateGalleryExternalTab | undefined {
    if (!useCase || useCase === 'all') {
        return undefined;
    }
    const normalized = useCase.toLowerCase();
    return tabs.find(tab => tab.useCases?.some(value => value.toLowerCase() === normalized));
}
