/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as htmlToText from 'html-to-text';
import { IParsedError } from '../index';
import { localize } from './localize';

// tslint:disable:no-unsafe-any
// tslint:disable:no-any
export function parseError(error: any): IParsedError {
    let errorType: string = '';
    let message: string = '';
    let stack: string | undefined;

    if (typeof (error) === 'object' && error !== null) {
        if (error.constructor !== Object) {
            errorType = error.constructor.name;
        }

        stack = error.stack;

        // See https://github.com/Microsoft/vscode-azureappservice/issues/419 for an example error that requires these 'unpack's
        error = unpackErrorFromField(error, 'value');
        error = unpackErrorFromField(error, '_value');
        error = unpackErrorFromField(error, 'error');
        if (Array.isArray(error.errors) && error.errors.length) {
            error = error.errors[0];
        }

        errorType = getCode(error, errorType);
        message = getMessage(error, message);

        if (!errorType || !message || /error.*deserializing.*response.*body/i.test(message)) {
            error = unpackErrorFromField(error, 'response');
            error = unpackErrorFromField(error, 'body');

            errorType = getCode(error, errorType);
            message = getMessage(error, message);
        }

        // Azure errors have a JSON object in the message
        let parsedMessage: any = parseIfJson(error.message);
        // For some reason, the message is sometimes serialized twice and we need to parse it again
        parsedMessage = parseIfJson(parsedMessage);
        // Extract out the "internal" error if it exists
        if (parsedMessage && parsedMessage.error) {
            parsedMessage = parsedMessage.error;
        }

        errorType = getCode(parsedMessage, errorType);
        message = getMessage(parsedMessage, message);

        message = message || convertCodeToError(errorType) || JSON.stringify(error);
    } else if (error !== undefined && error !== null && error.toString && error.toString().trim() !== '') {
        errorType = typeof (error);
        message = error.toString();
    }

    message = unpackErrorsInMessage(message);

    // tslint:disable-next-line:strict-boolean-expressions
    errorType = errorType || typeof (error);
    message = message || localize('unknownError', 'Unknown Error');

    message = parseIfHtml(message);

    return {
        errorType: errorType,
        message: message,
        stack: stack,
        // NOTE: Intentionally not using 'error instanceof UserCancelledError' because that doesn't work if multiple versions of the UI package are used in one extension
        // See https://github.com/Microsoft/vscode-azuretools/issues/51 for more info
        isUserCancelledError: errorType === 'UserCancelledError'
    };
}

function convertCodeToError(errorType: string | undefined): string | undefined {
    if (errorType) {
        const code: number = parseInt(errorType, 10);
        if (!isNaN(code)) {
            return localize('failedWithCode', 'Failed with code "{0}".', code);
        }
    }

    return undefined;
}

function parseIfJson(o: any): any {
    if (typeof o === 'string' && o.indexOf('{') >= 0) {
        try {
            return JSON.parse(o);
        } catch (err) {
            // ignore
        }
    }

    return o;
}

function parseIfHtml(message: string): string {
    if (/<html/i.test(message)) {
        try {
            return htmlToText.fromString(message, { wordwrap: false, uppercaseHeadings: false });
        } catch (err) {
            // ignore
        }
    }

    return message;
}

function getMessage(o: any, defaultMessage: string): string {
    return (o && (o.message || o.Message || (typeof parseIfJson(o.body) === 'string' && o.body))) || defaultMessage;
}

function getCode(o: any, defaultCode: string): string {
    const code: any = o && (o.code || o.Code || o.errorCode || o.statusCode);
    return code ? String(code) : defaultCode;
}

function unpackErrorsInMessage(message: string): string {
    // Handle messages like this from Azure (just handle first error for now)
    //   ["Errors":["The offer should have valid throughput]]",
    if (message) {
        const errorsInMessage: RegExpMatchArray | null = message.match(/"Errors":\[\s*"([^"]+)"/);
        if (errorsInMessage !== null) {
            const [, firstError] = errorsInMessage;
            return firstError;
        }
    }

    return message;
}

function unpackErrorFromField(error: any, prop: string): any {
    // Handle objects from Azure SDK that contain the error information in a "body" field (serialized or not)
    let field: any = error && error[prop];
    if (field) {
        if (typeof field === 'string' && field.indexOf('{') >= 0) {
            try {
                field = JSON.parse(field);
            } catch (err) {
                // Ignore
            }
        }

        if (typeof field === 'object') {
            return field;
        }
    }

    return error;
}
