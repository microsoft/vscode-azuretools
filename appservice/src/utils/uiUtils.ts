/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
}
