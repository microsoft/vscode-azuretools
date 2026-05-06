/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as React from 'react';
import { ConfirmationView } from "./ConfirmationView";
import { LoadingView } from "./LoadingView";
import { TemplateGalleryView } from "./TemplateGallery/TemplateGalleryView";

const registry: Record<string, React.ComponentType> = {
    confirmationView: ConfirmationView,
    loadingView: LoadingView,
    templateGalleryView: TemplateGalleryView,
};

/**
 * Register a view component by key. Internal use only — used by the package
 * to register built-in views.
 */
export function registerView(key: string, component: React.ComponentType): void {
    registry[key] = component;
}

/**
 * Look up a registered view component by key.
 */
export function getView(key: string): React.ComponentType | undefined {
    return registry[key];
}
