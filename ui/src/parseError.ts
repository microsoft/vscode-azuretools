/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IParsedError } from '../index';
import { localize } from './localize';

// tslint:disable:no-unsafe-any
// tslint:disable:no-any
export function parseError(error: any): IParsedError {
    let errorType: string = '';
    let message: string = '';

    error = unpackErrorFromBody(error);

    if (typeof (error) === 'object' && error !== null) {
        if (error.constructor !== Object) {
            errorType = error.constructor.name;
        }

        errorType = getCode(error, errorType);
        message = getMessage(error, message);

        // Azure errors have a JSON object in the message
        const parsedMessage: any = parseIfJson(error.message);
        errorType = getCode(parsedMessage, errorType);
        message = getMessage(parsedMessage, message);

        message = message || JSON.stringify(error);
    } else if (error !== undefined && error !== null && error.toString && error.toString().trim() !== '') {
        errorType = typeof (error);
        message = error.toString();
    }

    message = unpackErrorsInMessage(message);

    // tslint:disable-next-line:strict-boolean-expressions
    errorType = errorType || typeof (error);
    message = message || localize('unknownError', 'Unknown Error');

    return {
        errorType: errorType,
        message: message,
        // NOTE: Intentionally not using 'error instanceof UserCancelledError' because that doesn't work if multiple versions of the UI package are used in one extension
        // See https://github.com/Microsoft/vscode-azuretools/issues/51 for more info
        isUserCancelledError: errorType === 'UserCancelledError'
    };
}

function parseIfJson(o: any): any {
    if (typeof o === 'string' && o.indexOf('{') >= 0) {
        try {
            return JSON.parse(o);
        } catch {
            // ignore
        }
    }

    return o;
}

function getMessage(o: any, defaultMessage: string): string {
    return (o && (o.message || o.Message)) || defaultMessage;
}

function getCode(o: any, defaultCode: string): string {
    return (o && (o.code || o.Code || o.errorCode)) || defaultCode;
}

function unpackErrorsInMessage(message: string): string {
    // Handle messages like this from Azure (just handle first error for now)
    //   ["Errors":["The offer should have valid throughput бн",
    if (message) {
        const errorsInMessage: RegExpMatchArray | null = message.match(/"Errors":\[\s*"([^"]+)"/);
        if (errorsInMessage !== null) {
            const [, firstError] = errorsInMessage;
            return firstError;
        }
    }

    return message;
}

function unpackErrorFromBody(error: any): any {
    // Handle objects from Azure SDK that contain the error information in a "body" field (serialized or not)
    let body: any = error && error.body;
    if (body) {
        if (typeof body === 'string' && body.indexOf('{') >= 0) {
            try {
                body = JSON.parse(body);
            } catch (err) {
                // Ignore
            }
        }

        if (typeof body === 'object') {
            return body;
        }
    }

    return error;
}
