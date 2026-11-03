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

    message = parseIfHtml(message);

    // Azure storage SDK errors are presented in XML
    // https://github.com/Azure/azure-sdk-for-js/issues/6927
    message = parseIfXml(message);

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

function parseIfHtml(message: string): string {
    if (!/<html/i.test(message)) {
        return message;
    }

    const parts: string[] = [];
    const hidden: string[] = [];
    const anchors: (string | undefined)[] = [];
    let spaces = false;
    let breaks = 0;
    const append = (value: string): void => {
        if (parts.length) {
            parts.push(breaks ? '\n'.repeat(breaks) : spaces ? ' ' : '');
        }
        parts.push(value);
        breaks = 0;
        spaces = false;
    };
    const appendText = (value: string): void => {
        for (const match of value.matchAll(/\s+|\S+/g)) {
            if (/\s/.test(match[0][0])) {
                spaces = true;
            } else {
                append(match[0]);
            }
        }
    };
    let position = 0;
    while (position < message.length) {
        const opening = message.indexOf('<', position);
        if (!hidden.length) {
            appendText(message.slice(position, opening < 0 ? message.length : opening));
        }
        if (opening < 0) {
            break;
        }
        if (message.startsWith('<!--', opening)) {
            const end = message.indexOf('-->', opening + 4);
            position = end < 0 ? message.length : end + 3;
            spaces = true;
            continue;
        }
        const tag = readHtmlTag(message, opening);
        position = tag.end;
        if (!tag.complete) {
            spaces = true;
            continue;
        }
        const { name, closing } = tag;
        if (!closing && (name === 'script' || name === 'style')) {
            // Raw content may contain apparent tags and quotes; only its own closing tag matters.
            const ending = name === 'script' ? /<\/script\s*>/gi : /<\/style\s*>/gi;
            ending.lastIndex = position;
            const match = ending.exec(message);
            position = match ? ending.lastIndex : message.length;
            spaces = true;
            continue;
        }
        if (name === 'head' || name === 'template' || name === 'svg') {
            if (closing) {
                if (hidden[hidden.length - 1] === name) {
                    hidden.pop();
                }
            } else if (!tag.selfClosing) {
                hidden.push(name);
            }
            spaces = true;
            continue;
        }
        if (hidden.length) {
            continue;
        }
        if (name === 'p') {
            breaks = 2;
        } else if (name === 'br' || /^h[1-6]$/.test(name) || name === 'tr' || name === 'caption' || name === 'li') {
            breaks = Math.max(breaks, 1);
            if (name === 'li' && !closing) {
                append(' * ');
            }
        } else if (name === 'td' || name === 'th') {
            spaces ||= closing;
        } else if (name === 'a') {
            if (closing) {
                const href = anchors.pop();
                if (href !== undefined) {
                    spaces = true;
                    append(`[${href}]`);
                }
                spaces = false;
            } else {
                anchors.push(tag.href);
                spaces ||= tag.href === undefined;
            }
        } else {
            spaces = true;
        }
    }
    return decodeHtmlEntities(parts.join('').trim());
}

/**
 * A plain-text converter's tag reader, not an HTML parser or sanitizer.
 * Malformed markup is skipped up to the next unquoted '<' or the end of the input.
 */
function readHtmlTag(message: string, opening: number): { name: string; closing: boolean; selfClosing: boolean; complete: boolean; end: number; href?: string } {
    let position = opening + 1;
    const closing = message[position] === '/';
    if (closing) {
        position++;
    }
    const start = position;
    while (position < message.length && /[\w:-]/.test(message[position])) {
        position++;
    }
    const name = message.slice(start, position).toLowerCase();
    let href: string | undefined;
    let selfClosing = false;
    while (position < message.length && message[position] !== '<') {
        if (message[position] === '>') {
            return { name, closing, selfClosing, complete: true, end: position + 1, href };
        }
        if (/\s/.test(message[position])) {
            position++;
            continue;
        }
        if (message[position] === '/') {
            selfClosing = true;
            position++;
            continue;
        }
        const attributeStart = position;
        while (position < message.length && !/[\s=<>/"']/.test(message[position])) {
            position++;
        }
        const attribute = message.slice(attributeStart, position).toLowerCase();
        while (position < message.length && /\s/.test(message[position])) {
            position++;
        }
        const hasValue = message[position] === '=';
        if (hasValue) {
            position++;
            while (position < message.length && /\s/.test(message[position])) {
                position++;
            }
        }
        if (!hasValue && message[position] !== '"' && message[position] !== "'") {
            continue;
        }
        const quote = message[position] === '"' || message[position] === "'" ? message[position++] : undefined;
        const valueStart = position;
        if (quote) {
            while (position < message.length && message[position] !== quote) {
                position++;
            }
        } else if (message[position] !== '<' && message[position] !== '>') {
            while (position < message.length && !/[\s<>]/.test(message[position])) {
                position++;
            }
        }
        if (name === 'a' && attribute === 'href' && href === undefined) {
            href = message.slice(valueStart, position);
        }
        if (quote && position < message.length) {
            position++;
        }
    }
    return { name, closing, selfClosing, complete: false, end: position };
}

function decodeHtmlEntities(text: string): string {
    const namedEntities: Record<string, string> = {
        amp: '&',
        apos: '\'',
        bull: '\u2022',
        cent: '\u00A2',
        copy: '\u00A9',
        deg: '\u00B0',
        divide: '\u00F7',
        euro: '\u20AC',
        gt: '>',
        hellip: '\u2026',
        laquo: '\u00AB',
        ldquo: '\u201C',
        lsquo: '\u2018',
        lt: '<',
        mdash: '\u2014',
        middot: '\u00B7',
        nbsp: ' ',
        ndash: '\u2013',
        pound: '\u00A3',
        quot: '"',
        raquo: '\u00BB',
        rdquo: '\u201D',
        reg: '\u00AE',
        rsquo: '\u2019',
        times: '\u00D7',
        trade: '\u2122',
        yen: '\u00A5'
    };

    return text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity: string, name: string): string => {
        if (name[0] !== '#') {
            return namedEntities[name.toLowerCase()] ?? entity;
        }

        const isHex: boolean = name[1].toLowerCase() === 'x';
        const codePoint: number = parseInt(name.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        return codePoint <= 0x10FFFF ? String.fromCodePoint(codePoint) : entity;
    });
}

function parseIfXml(message: string): string {
    const openingTag = /<message>/i.exec(message);
    if (openingTag) {
        let end = -1;
        for (const closingTag of message.matchAll(/<\/message>/gi)) {
            end = closingTag.index;
        }
        const start = openingTag.index + openingTag[0].length;
        if (end >= start) {
            return message.slice(start, end);
        }
    }

    return message;
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
