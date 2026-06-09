/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type * from './contracts/AzureAccount';
export type * from './contracts/AzureAuthVsCode';
export * from './contracts/AzureSubscription';
export * from './contracts/AzureSubscriptionProvider';
export type * from '../contracts/AzureSubscriptionProviderRequestOptions'; // The types are exported, but the `DefaultOptions` constant and `getCoalescenceKey` function are internal only
export type * from './contracts/AzureTenant';
export * from './contracts/EnvironmentLike';

// The `AzureDevOpsCredential` is intentionally not exported here; it must be imported from
// `'@microsoft/vscode-azext-azureauth/next/testing'` so `@azure/identity` is not always bundled.
export * from './AzureSubscriptionProviderBase';
export * from './VSCodeAzureSubscriptionProvider';
export * from './VsCodeExtensionCredential';
export * from './challengeBearerTokenPolicy';
export * from './configuredEnvironment';
export * from './createChallengeSubscriptionClient';
export * from './utils/dedupeSubscriptions';
export * from './utils/getSessionFromVSCode';
export * from './utils/NotSignedInError';
