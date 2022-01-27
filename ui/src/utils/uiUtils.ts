/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PagedAsyncIterableIterator } from "@azure/core-paging";
import * as coreClient from '@azure/core-client';

export namespace uiUtils {
    export interface IPartialList<T> extends Array<T> {
        nextLink?: string;
    }

    export async function listAll<T>(client: { listNext(nextPageLink: string): Promise<IPartialList<T>>; }, first: Promise<IPartialList<T>>): Promise<T[]> {
        const all: T[] = [];

        let list: IPartialList<T> = await first;
        all.push(...list);
        while (list.nextLink) {
            list = await client.listNext(list.nextLink);
            all.push(...list);
        }

        return all;
    }

    export async function listAllIterator<T>(list: (options?: coreClient.OperationOptions) => PagedAsyncIterableIterator<T>): Promise<T[]> {
        const resources: T[] = [];
        for await (const r of list()) {
            resources.push(r);
        }

        return resources;
    }
}
