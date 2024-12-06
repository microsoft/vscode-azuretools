import { setConfiguredAzureEnv } from "../src";
import { getSessionFromVSCode } from "../src/getSessionFromVSCode";
import { TestVSCodeAuthentication } from "./MockVSCodeAuthentication";

suite('getSessionFromVSCode', async () => {
    test('no scopes and no tenant', async () => {
        const auth = new TestVSCodeAuthentication();
        await setConfiguredAzureEnv('AzureCloud');
        await auth.callWithExpectedArgs({
            providerId: 'microsoft',
            scopes: ['https://management.core.windows.net/.default'],
            options: undefined,
        }, async () => {
            await getSessionFromVSCode([], undefined, undefined, auth);
        });
    });

    test('ChinaCloud: no scopes and no tenant', async () => {
        const auth = new TestVSCodeAuthentication();

        await setConfiguredAzureEnv('ChinaCloud');

        await auth.callWithExpectedArgs({
            providerId: 'microsoft-sovereign-cloud',
            scopes: ['https://management.core.chinacloudapi.cn/.default'],
            options: undefined,
        }, async () => {
            await getSessionFromVSCode([], undefined, undefined, auth);
        });
    });

    test('no scopes and a tenant', async () => {
        const auth = new TestVSCodeAuthentication();
        await setConfiguredAzureEnv('AzureCloud');
        await auth.callWithExpectedArgs({
            providerId: 'microsoft',
            scopes: ['https://management.core.windows.net/.default', 'VSCODE_TENANT:tenantId'],
            options: undefined,
        }, async () => {
            await getSessionFromVSCode([], 'tenantId', undefined, auth);
        });
    });
});
