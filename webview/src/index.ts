/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export * from './extension/ConfirmationViewController';
export * from './extension/extensionVariables';
export * from './extension/LoadingViewController';
export * from './extension/OpenConfirmationViewStep';
export * from './extension/OpenLoadingViewStep';
export * from './extension/TemplateGalleryController';
export { WebviewBaseController } from './extension/WebviewBaseController';
export { WebviewController } from './extension/WebviewController';
export type { WebviewBundleLocation } from './extension/WebviewController';
export type {
    ActiveView, AiState, ExtensionToWebviewMessage, FilterState, IProjectTemplate,
    TemplateGalleryConfig, TemplateGalleryWorkspaceOption, TemplateGalleryWorkspaceOptionValues,
    ViewMode, WebviewToExtensionMessage
} from './webview/TemplateGallery/types';
