/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export * from './createAppService/createFunctionApp';
export * from './createAppService/createWebApp';
export * from './createAppService/IAppCreateOptions';
export * from './deploy/deploy';
export * from './deleteSite';
export * from './editScmType';
export * from './getFile';
export * from './getKuduClient';
export * from './functionsAdminRequest';
export * from './pingFunctionApp';
export * from './putFile';
export * from './SiteClient';
export * from './startStreamingLogs';
export * from './tree/AppSettingsTreeItem';
export * from './tree/AppSettingTreeItem';
export * from './TunnelProxy';
export { registerAppServiceExtensionVariables } from './extensionVariables';
