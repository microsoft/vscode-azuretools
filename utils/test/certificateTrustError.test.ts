/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IParsedError } from '..';
import { parseError } from '../src/parseError';
import { isCertificateTrustError } from '../src/utils/certificateTrustError';

function parsed(partial: Partial<IParsedError>): IParsedError {
    return {
        errorType: '',
        message: '',
        isUserCancelledError: false,
        name: 'Error',
        ...partial,
    } as IParsedError;
}

suite('isCertificateTrustError', () => {
    test('matches Node TLS error codes (errorType)', () => {
        const codes = [
            'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
            'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
            'SELF_SIGNED_CERT_IN_CHAIN',
            'DEPTH_ZERO_SELF_SIGNED_CERT',
            'CERT_UNTRUSTED',
        ];
        for (const errorType of codes) {
            assert.strictEqual(isCertificateTrustError(parsed({ errorType })), true, errorType);
        }
    });

    test('matches error code embedded in the message', () => {
        assert.strictEqual(isCertificateTrustError(parsed({ message: 'request failed: SELF_SIGNED_CERT_IN_CHAIN' })), true);
    });

    test('matches OpenSSL human-readable messages (case-insensitive)', () => {
        assert.strictEqual(isCertificateTrustError(parsed({ message: 'unable to get local issuer certificate' })), true);
        assert.strictEqual(isCertificateTrustError(parsed({ message: 'Error: Unable To Get Local Issuer Certificate' })), true);
        assert.strictEqual(isCertificateTrustError(parsed({ message: 'self signed certificate in certificate chain' })), true);
        assert.strictEqual(isCertificateTrustError(parsed({ message: 'self-signed certificate' })), true);
        assert.strictEqual(isCertificateTrustError(parsed({ message: 'unable to verify the first certificate' })), true);
    });

    test('does not match unrelated errors', () => {
        assert.strictEqual(isCertificateTrustError(parsed({ errorType: 'ECONNREFUSED', message: 'connection refused' })), false);
        assert.strictEqual(isCertificateTrustError(parsed({ errorType: 'NotFoundError', message: 'The resource was not found.' })), false);
        assert.strictEqual(isCertificateTrustError(parsed({ message: '' })), false);
        assert.strictEqual(isCertificateTrustError(parsed({})), false);
    });

    test('works with parseError output for a realistic cert error', () => {
        const err = Object.assign(new Error('unable to get local issuer certificate'), { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' });
        assert.strictEqual(isCertificateTrustError(parseError(err)), true);
    });
});
