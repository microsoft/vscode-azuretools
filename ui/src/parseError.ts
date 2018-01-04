/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from './localize';

// tslint:disable-next-line:no-any
export function parseError(error: any): IParsedError {
    let errorType: string;
    let message: string;
    if (error instanceof Error) {
        try {
            // Azure errors have a JSON object in the message
            // tslint:disable-next-line:no-unsafe-any
            errorType = JSON.parse(error.message).Code;
            // tslint:disable-next-line:no-unsafe-any
            message = JSON.parse(error.message).Message;
        } catch (err) {
            errorType = error.constructor.name;
            message = error.message;
        }
    } else if (typeof (error) === 'object' && error !== null) {
        errorType = (<object>error).constructor.name;
        message = JSON.stringify(error);
        // tslint:disable-next-line:no-unsafe-any
    } else if (error !== undefined && error !== null && error.toString && error.toString().trim() !== '') {
        errorType = typeof (error);
        // tslint:disable-next-line:no-unsafe-any
        message = error.toString();
    } else {
        errorType = typeof (error);
        message = localize('unknownError', 'Unknown Error');
    }

    return {
        errorType: errorType,
        message: message
    };
}

export interface IParsedError {
    errorType: string;
    message: string;
}
