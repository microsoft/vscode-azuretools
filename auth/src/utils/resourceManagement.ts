import { type SubscriptionClient } from '@azure/arm-resources-subscriptions';
import { type TokenCredential } from '@azure/core-auth';
import { type AuthenticationSession } from 'vscode';
import { type AzureAuthentication } from '../AzureAuthentication';
import { getConfiguredAzureEnv } from './configuredAzureEnv';

/**
 * Gets a fully-configured subscription client for a given tenant ID
 *
 * @param tenantId (Optional) The tenant ID to get a client for
 *
 * @returns A client, the credential used by the client, and the authentication function
 */
export async function getSubscriptionClient(session: AuthenticationSession): Promise<{ client: SubscriptionClient, credential: TokenCredential, authentication: AzureAuthentication }> {
    const armSubs = await import('@azure/arm-resources-subscriptions');

    const credential: TokenCredential = {
        getToken: async () => {
            return {
                token: session.accessToken,
                expiresOnTimestamp: 0
            };
        }
    }

    const configuredAzureEnv = getConfiguredAzureEnv();
    const endpoint = configuredAzureEnv.resourceManagerEndpointUrl;

    return {
        client: new armSubs.SubscriptionClient(credential, { endpoint }),
        credential: credential,
        authentication: {
            getSession: () => session
        }
    };
}
