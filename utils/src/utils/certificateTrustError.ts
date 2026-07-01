/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IParsedError } from '../../index';

/**
 * Default troubleshooting documentation for certificate trust failures. All Azure extensions
 * link their README troubleshooting sections to this canonical location.
 */
export const certificateTroubleshootingLink: string = 'https://github.com/microsoft/vscode-azureresourcegroups/blob/main/README.md#troubleshooting';

/**
 * Node.js/OpenSSL TLS error codes that indicate the runtime could not build a trusted
 * certificate chain, which on developer machines is almost always a corporate proxy or
 * SSL-inspection appliance whose root CA is not trusted by the Node extension host.
 */
const certificateErrorCodes: readonly string[] = [
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'CERT_UNTRUSTED',
    'CERT_SIGNATURE_FAILURE',
    'CERT_CHAIN_TOO_LONG',
];

/**
 * Message fragments that map to the same certificate trust failures. Some SDKs surface the
 * human-readable OpenSSL string rather than the error code.
 */
const certificateErrorMessages: readonly string[] = [
    'unable to get local issuer certificate',
    'unable to verify the first certificate',
    'self signed certificate',
    'self-signed certificate',
];

/**
 * Determines whether a parsed error was caused by an untrusted TLS certificate chain, which
 * typically happens behind a corporate proxy or SSL-inspection appliance. Callers can use this
 * to surface targeted troubleshooting guidance (see {@link certificateTroubleshootingLink})
 * instead of the raw, cryptic error.
 */
export function isCertificateTrustError(parsedError: IParsedError): boolean {
    const errorType = (parsedError.errorType ?? '').toUpperCase();
    if (certificateErrorCodes.some(code => errorType === code)) {
        return true;
    }

    const message = (parsedError.message ?? '').toLowerCase();
    if (!message) {
        return false;
    }

    if (certificateErrorCodes.some(code => message.includes(code.toLowerCase()))) {
        return true;
    }

    return certificateErrorMessages.some(fragment => message.includes(fragment));
}
