/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { type WebviewApi } from 'vscode-webview';
import { DynamicThemeProvider, type DynamicThemeProviderProps } from './theme/DynamicThemeProvider';
import { type WebviewState, WithWebviewContext } from './WebviewContext';

/**
 * A map from view-key (the `webviewName` passed to a `WebviewController`) to the
 * React component that should render for that key.
 */
export type WebviewComponentRegistry = Readonly<Record<string, React.ComponentType>>;

export type CreateWebviewRenderOptions = {
    /**
     * Options forwarded to `DynamicThemeProvider`. Defaults to `{ useAdaptive: true }`.
     */
    themeProviderProps?: DynamicThemeProviderProps;
    /**
     * Optional wrapper rendered around the resolved view component, inside the theme/context
     * providers. Use this to inject extension-specific providers (e.g. a custom Channel or
     * localization context) without re-implementing the render bootstrap.
     */
    wrap?: (node: React.ReactNode) => React.ReactNode;
};

/**
 * Builds a `render(key, vscodeApi, rootId?)` entry function for a webview bundle.
 *
 * Consuming extensions that want to ship their own React views should:
 *   1. Build their own browser bundle whose entry calls this factory with their components.
 *   2. Point the controller at that bundle via `WebviewBundleLocation`.
 *
 * Example:
 * ```ts
 * // myExtension/src/webview/entry.tsx
 * import { createWebviewRender } from '@microsoft/vscode-azext-webview/webview';
 * import { MyView } from './MyView';
 *
 * export const render = createWebviewRender({ myView: MyView });
 * ```
 */
export function createWebviewRender<R extends WebviewComponentRegistry>(
    registry: R,
    options: CreateWebviewRenderOptions = {},
): (key: keyof R & string, vscodeApi: WebviewApi<WebviewState>, rootId?: string) => void {
    const themeProviderProps = options.themeProviderProps ?? { useAdaptive: true };
    const wrap = options.wrap ?? ((node) => node);

    return function render(key, vscodeApi, rootId = 'root'): void {
        const container = document.getElementById(rootId);
        if (!container) {
            throw new Error(`Element with id of ${rootId} not found.`);
        }

        const Component = registry[key];
        if (!Component) {
            throw new Error(`No webview component registered for key "${String(key)}".`);
        }

        const root = createRoot(container);

        root.render(
            <DynamicThemeProvider {...themeProviderProps}>
                <WithWebviewContext vscodeApi={vscodeApi}>
                    {wrap(React.createElement(Component))}
                </WithWebviewContext>
            </DynamicThemeProvider>,
        );
    };
}
