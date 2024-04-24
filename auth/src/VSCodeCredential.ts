import { AccessToken, GetTokenOptions, TokenCredential } from "@azure/core-auth";
import { getSessionFromVSCode } from "./getSessionFromVSCode";

/**
 * For use with Azure SDKs
 */
export class VSCodeAzureSDKCredential implements TokenCredential {
    public async getToken(scopes: string | string[], options?: GetTokenOptions | undefined): Promise<AccessToken | null> {
        const session = await getSessionFromVSCode(scopes, options?.tenantId, { createIfNone: true });
        return {
            token: session?.accessToken ?? "",
            expiresOnTimestamp: 0
        };
    }
}
