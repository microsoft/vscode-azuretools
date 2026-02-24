/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureTenant } from '../contracts/AzureTenant';

// These regexes are not perfect, but should work for common cases
// If they don't work, we'll just return the account ID, which does not need to be screened
const accountLabelRegex = /^(?<email>[^@]+)@(?<domain>[\w]+(\.[\w]+)+)$/i;
const domainRegex = /^(?<domain>[^.]+)(?<safeTld>\.com(\..*)?|\.net|\.org|\.co\..*|\.gov)$/i;

/**
 * Screens the label or display name of an Azure account or tenant so that it can be logged without exposing PII.
 * This should *NOT* be considered fool-proof nor safe for telemetry, but is acceptable for local logging.
 * @param accountOrTenant The account or tenant to screen the label / display name of
 * @returns The screened label / display name
 */
export function screen(accountOrTenant: Pick<AzureAccount, 'id' | 'label'> | Pick<AzureTenant, 'tenantId' | 'displayName'>): string {
    if ('label' in accountOrTenant && !!accountOrTenant.label) {
        const match = accountLabelRegex.exec(accountOrTenant.label);
        if (match?.groups?.email && match.groups.domain) {
            let screenedEmail = match.groups.email;
            if (screenedEmail.length <= 2) {
                screenedEmail = '***';
            } else {
                screenedEmail = `${screenedEmail.at(0)}***${screenedEmail.at(-1)}`;
            }

            let screenedDomain = match.groups.domain;
            const domainMatch = domainRegex.exec(match.groups.domain);
            if (domainMatch?.groups?.domain && domainMatch.groups.safeTld) {
                if (domainMatch.groups.domain.length <= 2) {
                    screenedDomain = `***${domainMatch.groups.safeTld}`;
                } else {
                    screenedDomain = `${domainMatch.groups.domain.at(0)}***${domainMatch.groups.safeTld}`;
                }
            } else if (screenedDomain.length <= 2) {
                screenedDomain = '***';
            } else {
                screenedDomain = `${screenedDomain.at(0)}***${screenedDomain.at(-1)}`;
            }

            return `${screenedEmail}@${screenedDomain}`;
        }

        // If we can't match it with our simple regex, just return the account ID instead
        return accountOrTenant.id;
    } else if ('displayName' in accountOrTenant && !!accountOrTenant.displayName) {
        if (accountOrTenant.displayName.length <= 2) {
            // For too-short names, just return the ID
            return accountOrTenant.tenantId;
        } else {
            // Return the first character, three stars, and the last character
            return `${accountOrTenant.displayName.at(0)}***${accountOrTenant.displayName.at(-1)}`;
        }
    }

    return 'unknown';
}
