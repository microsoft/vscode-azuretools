/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Barrel export for webview-side React infrastructure that other extensions
 * can reuse when bundling their own webviews.
 */

export type { Channel } from './Channel/Channel';
export { CommonChannel } from './Channel/CommonChannel';
export { WebviewChannel } from './Channel/WebviewChannel';
export { WebviewTransport } from './Channel/WebviewTransport';
export { createWebviewRender } from './createWebviewRender';
export type { CreateWebviewRenderOptions, WebviewComponentRegistry } from './createWebviewRender';
export { DynamicThemeProvider } from './theme/DynamicThemeProvider';
export type { DynamicThemeProviderProps } from './theme/DynamicThemeProvider';
export { useConfiguration } from './useConfiguration';
export { WebviewContext, WithWebviewContext } from './WebviewContext';
export type { WebviewContextValue, WebviewState } from './WebviewContext';

