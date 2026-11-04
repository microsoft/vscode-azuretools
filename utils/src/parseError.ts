/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable */

import * as vscode from 'vscode';
import { IParsedError } from '../index';
import { isUserCancelledError } from './errors';
import { parseJson } from './utils/parseJson';

const lineBreakPattern = /[\r\n\u2028\u2029]/;
const trailingLineBreakPattern = new RegExp(`(?:\\r\\n|${lineBreakPattern.source})$`);

export function parseError(error: any): IParsedError {
    let errorType: string = '';
    let message: string = '';
    let stack: string | undefined;
    let stepName: string | undefined;

    if (typeof (error) === 'object' && error !== null) {
        if (error.constructor !== Object) {
            errorType = error.constructor.name;
        }

        stack = getCallstack(error);
        errorType = getCode(error, errorType);

        // See https://github.com/Microsoft/vscode-azureappservice/issues/419 for an example error that requires these 'unpack's
        error = unpackErrorFromField(error, 'value');
        error = unpackErrorFromField(error, '_value');
        error = unpackErrorFromField(error, 'error');
        error = unpackErrorFromField(error, 'error');
        if (Array.isArray(error.errors) && error.errors.length) {
            error = error.errors[0];
        }

        errorType = getCode(error, errorType);
        message = getMessage(error, message);

        if (!errorType || !message || isResponseDeserializationError(message)) {
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

        message ||= convertCodeToError(errorType) || JSON.stringify(error);

        if ('stepName' in error && typeof error.stepName === 'string') {
            stepName = error.stepName;
        }
    } else if (error !== undefined && error !== null && error.toString && error.toString().trim() !== '') {
        errorType = typeof (error);
        message = error.toString();
    }

    message = unpackErrorsInMessage(message);

    [message, errorType] = parseIfFileSystemError(message, errorType);

    errorType ||= typeof (error);
    message ||= vscode.l10n.t('Unknown Error');
    message = summarizeMarkupError(message, errorType);

    return {
        name: errorType,
        errorType: errorType,
        message: message,
        stack: stack,
        stepName,
        // NOTE: Intentionally not using 'error instanceof UserCancelledError' because that doesn't work if multiple versions of the UI package are used in one extension
        // See https://github.com/Microsoft/vscode-azuretools/issues/51 for more info
        isUserCancelledError:
            // check using both methods in case error was created before we implemented isUserCancelledError
            isUserCancelledError(error) ||
            errorType === 'UserCancelledError' ||
            error instanceof vscode.CancellationError
    };
}

function convertCodeToError(errorType: string | undefined): string | undefined {
    if (errorType) {
        const code: number = parseInt(errorType, 10);
        if (!isNaN(code)) {
            return vscode.l10n.t('Failed with code "{0}".', code);
        }
    }

    return undefined;
}

function parseIfJson(o: any): any {
    if (typeof o === 'string' && o.indexOf('{') >= 0) {
        try {
            return parseJson(o);
        } catch (err) {
            // ignore
        }
    }

    return o;
}

function isResponseDeserializationError(message: string): boolean {
    return message.toLowerCase().split(lineBreakPattern).some(line => {
        let position = 0;
        for (const word of ['error', 'deserializing', 'response', 'body']) {
            const index = line.indexOf(word, position);
            if (index < 0) {
                return false;
            }
            position = index + word.length;
        }
        return true;
    });
}

function summarizeMarkupError(message: string, errorType: string): string {
    const kind = /<(?:html\b|!doctype\s+html\b)/i.test(message) ? 'HTML'
        : /<(?:\?xml\b|error\b|message\b)/i.test(message) ? 'XML' : undefined;
    if (!kind) {
        return message;
    }

    const tag = kind === 'HTML' ? 'title' : 'message';
    const opening = new RegExp(`<${tag}\\s*>`, 'i').exec(message);
    if (opening) {
        const content = message.slice(opening.index + opening[0].length);
        const closing = new RegExp(`</${tag}\\s*>`, 'i').exec(content);
        if (closing) {
            let summary = content.slice(0, closing.index).trim();
            if (kind === 'XML') {
                summary = summary.split(lineBreakPattern)[0];
            }
            if (summary && !/[<>]/.test(summary)) {
                summary = decodeSummaryEntities(summary).replace(/\s+/g, ' ').trim();
                if (summary) {
                    return summary.length > 300 ? `${summary.slice(0, 297)}...` : summary;
                }
            }
        }
    }

    return /^\d{3}$/.test(errorType)
        ? vscode.l10n.t('The server returned an {0} error response (HTTP {1}).', kind, errorType)
        : vscode.l10n.t('The server returned an {0} error response.', kind);
}

function decodeSummaryEntities(text: string): string {
    const entities: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
    return text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity: string, name: string): string => {
        if (name[0] !== '#') {
            const key = name.toLowerCase();
            return Object.hasOwn(entities, key) ? entities[key] : entity;
        }
        const hex = name[1].toLowerCase() === 'x';
        const codePoint = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
        return codePoint <= 0x10FFFF ? String.fromCodePoint(codePoint) : entity;
    });
}

function getMessage(o: any, defaultMessage: string): string {
    return (o && (o.message || o.Message || o.detail || (typeof parseIfJson(o.body) === 'string' && o.body))) || defaultMessage;
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
                field = parseJson(field);
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

/**
 * Example line in the stack:
 * at FileService.StorageServiceClient._processResponse (/path/ms-azuretools.vscode-azurestorage-0.6.0/node_modules/azure-storage/lib/common/services/storageserviceclient.js:751:50)
 *
 * Final minified line:
 * FileService.StorageServiceClient._processResponse azure-storage/storageserviceclient.js:751:50
 */
function getCallstack(error: { stack?: unknown }): string | undefined {
    const stack: string = typeof error.stack === 'string' ? error.stack : '';

    const minifiedLines: (string | undefined)[] = stack
        .split(lineBreakPattern)
        .map(l => {
            let result: string = '';
            // Get just the file name, line number and column number
            // From above example: storageserviceclient.js:751:50
            const fileMatch = l.split(/[\/\\(\s]/).map(part => /^.+\.[tj]s:[0-9]+:[0-9]+/i.exec(part)).find(match => match);

            // Ignore any lines without a file match (e.g. "at Generator.next (<anonymous>)")
            if (fileMatch) {
                // Get the function name
                // From above example: FileService.StorageServiceClient._processResponse
                const frame = l.trimStart();
                const opening = frame.indexOf('(');
                if (/^at /i.test(frame) && opening >= 0) {
                    const functionName = frame.slice(3, opening);
                    if (!/^[\\/]/.test(functionName)) {
                        const start = Math.max(functionName.lastIndexOf('/'), functionName.lastIndexOf('\\')) + 1;
                        result += functionName.slice(start);
                    }
                }

                const parts: string[] = [];

                // Get the name of the node module (and any sub modules) containing the file
                // From above example: azure-storage
                const moduleRegExp: RegExp = /node_modules(?:\\|\/)([^\\\/]+)/ig;
                let moduleMatch: RegExpExecArray | null;
                do {
                    moduleMatch = moduleRegExp.exec(l);
                    if (moduleMatch) {
                        parts.push(moduleMatch[1]);
                    }
                } while (moduleMatch);

                parts.push(fileMatch[0]);
                result += parts.join('/');
            }

            return result;
        })
        .filter(l => !!l);

    return minifiedLines.length > 0 ? minifiedLines.join('\n') : undefined;
}

/**
 * See https://github.com/microsoft/vscode-cosmosdb/issues/1580 for an example error
 */
function parseIfFileSystemError(message: string, errorType: string): [string, string] {
    const lastLine = message.replace(trailingLineBreakPattern, '').split(lineBreakPattern).pop() ?? '';
    const match = /\(([a-z]*) \(FileSystemError\)/i.exec(lastLine);
    if (match && match.index + match[0].length < lastLine.length && lastLine.endsWith(')')) {
        message = lastLine.slice(match.index + 1, -1);
        errorType = match[1];
    }
    return [message, errorType];
}
