/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import KuduClient from 'vscode-azurekudu';
import { getKuduClient } from './getKuduClient';
import { localize } from './localize';
import { SiteClient } from './SiteClient';

export interface IFileResult {
    data: string;
    etag: string;
}

export async function getFile(client: SiteClient, filePath: string): Promise<IFileResult> {
    const kuduClient: KuduClient = await getKuduClient(client);
    // tslint:disable:no-unsafe-any
    // tslint:disable-next-line:no-any
    const response: any = (<any>await kuduClient.vfs.getItemWithHttpOperationResponse(filePath)).response;
    if (response && response.body && response.headers && response.headers.etag) {
        return { data: response.body, etag: response.headers.etag };
        // tslint:enable:no-unsafe-any
    } else {
        throw new Error(localize('failedToFindFile', 'Failed to find file with path "{0}".', filePath));
    }
}
