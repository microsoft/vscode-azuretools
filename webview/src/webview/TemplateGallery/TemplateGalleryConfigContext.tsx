/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { createContext, useContext, useMemo } from 'react';
import {
    defaultCategoryDisplayNames,
    defaultLanguageDisplayNames,
    defaultLanguageFilterMap,
    defaultLanguageOrder,
    defaultResourceDisplayNames,
    type TemplateGalleryConfig,
} from './types';

export interface TemplateGalleryConfigContextValue {
    serviceName: string;
    headerTitle: string;
    headerSubtitle: string;
    supportsAiGeneration: boolean;
    languageDisplayNames: Record<string, string>;
    categoryDisplayNames: Record<string, string>;
    resourceDisplayNames: Record<string, string>;
    languageFilterMap: Record<string, string>;
    languageOrder: string[];
}

const TemplateGalleryConfigContext = createContext<TemplateGalleryConfigContextValue>({
    serviceName: '',
    headerTitle: '',
    headerSubtitle: '',
    supportsAiGeneration: false,
    languageDisplayNames: defaultLanguageDisplayNames,
    categoryDisplayNames: defaultCategoryDisplayNames,
    resourceDisplayNames: defaultResourceDisplayNames,
    languageFilterMap: defaultLanguageFilterMap,
    languageOrder: defaultLanguageOrder,
});

/**
 * Provider that merges extension-supplied config with package defaults.
 */
export const TemplateGalleryConfigProvider = ({
    config,
    children,
}: {
    config: TemplateGalleryConfig;
    children: React.ReactNode;
}) => {
    const value = useMemo<TemplateGalleryConfigContextValue>(() => ({
        serviceName: config.serviceName,
        headerTitle: config.headerTitle,
        headerSubtitle: config.headerSubtitle,
        supportsAiGeneration: config.supportsAiGeneration,
        languageDisplayNames: { ...defaultLanguageDisplayNames, ...config.languageDisplayNames },
        categoryDisplayNames: { ...defaultCategoryDisplayNames, ...config.categoryDisplayNames },
        resourceDisplayNames: { ...defaultResourceDisplayNames, ...config.resourceDisplayNames },
        languageFilterMap: { ...defaultLanguageFilterMap, ...config.languageFilterMap },
        languageOrder: config.languageOrder ?? defaultLanguageOrder,
    }), [config]);

    return (
        <TemplateGalleryConfigContext.Provider value={value}>
            {children}
        </TemplateGalleryConfigContext.Provider>
    );
};

/**
 * Hook to access the merged gallery configuration (static config + defaults).
 */
export function useTemplateGalleryConfig(): TemplateGalleryConfigContextValue {
    return useContext(TemplateGalleryConfigContext);
}
