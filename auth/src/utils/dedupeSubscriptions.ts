/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// The implementation lives in `./next`; the legacy `.` entrypoint re-exports it. The function is
// generic over the subscription shape, so both the legacy and `./next` `AzureSubscription` types work.
export { dedupeSubscriptions, type DedupableSubscription } from '../next/utils/dedupeSubscriptions';
