/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createPipelineRequest, type PipelineResponse } from '@azure/core-rest-pipeline';
import * as assert from 'assert';
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { HttpProxyAgent } from 'http-proxy-agent';
import { Agent as HttpsAgent, createServer as createHttpsServer, get as httpsGet, type Server as HttpsServer } from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { type AddressInfo, connect as netConnect, type Socket } from 'net';
import * as vscode from 'vscode';
import { ProxyAgentPolicy, getProxyAgent, getProxySettings, isHostBypassed } from '../src/utils/ProxyAgentPolicy';

const proxyEnvVars = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'];

// A long-lived self-signed certificate (CN=localhost, SAN IP:127.0.0.1) used by the TLS integration
// tests below. Embedded so the tests need no external tooling (e.g. openssl) and are CI-portable.
const SELF_SIGNED_CERT = `-----BEGIN CERTIFICATE-----
MIIDJzCCAg+gAwIBAgIUVNxIkVKNPsJkZCWqmm7slz/9tKUwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MDcwMTE5MDgyMVoYDzIxMjYw
NjA3MTkwODIxWjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDWqH+g1XNPbjnuGjbwmSWq9tFLQUKkU3tlhvJD5Khk
3ww2QScubd3BTfE9GdXG7vbD+c3B8obLmloIj7VFA01UlPmlIlTR38jTzg9cprF/
H8cypwAgOdOU99zKxlC4F20id9p1MeTmgwWoj6xh+3wnZWPk/yhVg7V5RoBr0B21
PNEFg0k4ahzMMy5e1GWJRTN2mKvaXMVP3AJyPXQ8m31HANbNIkhulShiYT8In9X8
IviYdDd0NGb/CXVoEOVKN+5Is51FtjRa6FQ0hr0ymc2gQIy8lGlzHXTxqicKZEp3
DxRqRaIOh7rjG0jcQAiqtKLRw94luTXI4RVzRkkdAW+BAgMBAAGjbzBtMB0GA1Ud
DgQWBBR2vt36I8fIZVDk5ovl/2Mx5oGDoTAfBgNVHSMEGDAWgBR2vt36I8fIZVDk
5ovl/2Mx5oGDoTAPBgNVHRMBAf8EBTADAQH/MBoGA1UdEQQTMBGHBH8AAAGCCWxv
Y2FsaG9zdDANBgkqhkiG9w0BAQsFAAOCAQEAtIBk6d0vqTJ6lHJ4CNX6NjBMQiTG
cUs4CWcd6UzoJkLcgrioGWOLvPwXc8MSPU2NBJoZG0jwpHM2qpoBo6ZwsdmOTBXG
ujwwKLiWV1AaCyLFOlf7hwkVqCI409Hxc5kMZl04pwWtcZEEzzGR1rWYm0IyJ6Q/
TbiUp2+kzKJdP73aBvF+4pqiDflgwJxsX/QDiw1zQi23/xQyVSDC8e2JAFxZ/Hnb
ROoau60V4Y8ol6Np/Xw6vwmLM6VAIB6KJzIf6huPF1jLC5IdrfFy5+sCjUwOccaz
/cZMXIDdWkdGiFWmoznNTDW8hZ4AbVWWnebRcbhX7zfnAvDase2avqDY+w==
-----END CERTIFICATE-----
`;

const SELF_SIGNED_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDWqH+g1XNPbjnu
GjbwmSWq9tFLQUKkU3tlhvJD5Khk3ww2QScubd3BTfE9GdXG7vbD+c3B8obLmloI
j7VFA01UlPmlIlTR38jTzg9cprF/H8cypwAgOdOU99zKxlC4F20id9p1MeTmgwWo
j6xh+3wnZWPk/yhVg7V5RoBr0B21PNEFg0k4ahzMMy5e1GWJRTN2mKvaXMVP3AJy
PXQ8m31HANbNIkhulShiYT8In9X8IviYdDd0NGb/CXVoEOVKN+5Is51FtjRa6FQ0
hr0ymc2gQIy8lGlzHXTxqicKZEp3DxRqRaIOh7rjG0jcQAiqtKLRw94luTXI4RVz
RkkdAW+BAgMBAAECggEAAzE/kPyCt1OEZP+BKvxp2Im4UnANr4eq3kaxR8uloB0j
aHSsW/XosHi7amM7WnRMlbkG7Sqz5Ws7+qB/EWKVIHRwackyOPm0QGYlYtxhn/7K
VRvavxW0wYrdk2iZ6RPvT/MjH7CMXuBeesEOzv0yQtScNX6pjszRjPXMCdD+hEWT
WFbn0KOr3rxxvIraDaBAGPyLZ3VvDNMxPlySNaE2FFcAr5/tQkH/AjFniEmNn0/j
EubQ4rXhtnL6Nb1zJ1rWYlf9Pc8JBokiOj5iGN4y5HuMHFYjcVbiUcuRodWxO7fk
P3fS8UHd5mXoTH737NYDzrP+8UMsRMieRIUkCFSW6wKBgQD6VPCbi87Y9qhypotq
gStp4lLIDPSvQA6gDHQfxg8ajjoHLVtjC3dE5YiUSseQLPsko6xW8RZIdXXeQj0F
WA/c6jW88mt9YZgxmwvTLuHsiRCyy/a7Kx38RF0Bs10YTrkA3LWTVchAwQBxA61x
Fy7rfQl9PgJAgtfjK4VMSYX7NwKBgQDbhMZkOquICeKsHyI1YOoHyZIOpVoluLnc
jhsAn4cZPQHm2fkKlVEcLUjXLgoTLv2uQJdUwbOLFGSF1DRvFOBtF+r4ugMZvXQ5
JC4366ei8iRaoTPEiLQ54E03rCCbv2NkMZErHUpGi959rj8Skk246E2LBmpD1bTu
+PswVHd3BwKBgQCExtLMHg67w7C7Bx1Bg3vMcK/pzf1mivp258QcKkhOlIuwzN0B
Hs7HK1wTE8rf7QvUdj/t6XghPLQlDEsjb38SdOPF8WsUGNTJ0uwlumM4u8awn0Ci
LA9+g6A1S7agMvkrvOVOXZyWxAgA6atwJZTMcQi8dkxpfT0XEDlmqkS3ZwKBgFug
aRrO7mgjEC0d9a5oHGdRuJhKZn1WRKYN3rF85Owg7dlI5E2Jk8h6EmxWuDfXpmWE
amYjT+jegzLlJ1myUhbXI+nb4o1s6cUsF+qZf2hhP9FgdfYzxV5fBHwXaaj40uiw
U9K2MBmQKjc1cvgyfySOOkesTtCvtA0HeflrWE4jAoGAGu9mPYnYUZ+zZ4wEMdkz
u0YQJLhXBcGRPhJQqVrrp+Ictib5Sdw59xHAlT3Iq5TA6qiEL9fNd0rGypGEZ8BF
oX3w10zmzcTzOJF8XeOBQiqQljaU6mvX6d8P2ztMFiwiz4ownBmQFF26hDUQMDOJ
bdxlbZ4Db+n5TnFSKoHhEHo=
-----END PRIVATE KEY-----
`;

suite('isHostBypassed', () => {
    test('empty list never bypasses', () => {
        assert.strictEqual(isHostBypassed('management.azure.com', []), false);
    });

    test('exact host match', () => {
        assert.strictEqual(isHostBypassed('management.azure.com', ['management.azure.com']), true);
        assert.strictEqual(isHostBypassed('login.microsoftonline.com', ['management.azure.com']), false);
    });

    test('is case-insensitive', () => {
        assert.strictEqual(isHostBypassed('Management.Azure.COM', ['management.azure.com']), true);
    });

    test('.domain suffix matches domain and subdomains', () => {
        assert.strictEqual(isHostBypassed('management.azure.com', ['.azure.com']), true);
        assert.strictEqual(isHostBypassed('azure.com', ['.azure.com']), true);
        assert.strictEqual(isHostBypassed('azure.com.evil.com', ['.azure.com']), false);
    });

    test('*.domain is treated as a suffix', () => {
        assert.strictEqual(isHostBypassed('management.azure.com', ['*.azure.com']), true);
    });

    test('* bypasses everything', () => {
        assert.strictEqual(isHostBypassed('management.azure.com', ['*']), true);
    });
});

suite('getProxyAgent', () => {
    const savedEnv: Record<string, string | undefined> = {};

    suiteSetup(() => {
        for (const key of proxyEnvVars) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });

    suiteTeardown(() => {
        for (const key of proxyEnvVars) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedEnv[key];
            }
        }
    });

    teardown(() => {
        for (const key of proxyEnvVars) {
            delete process.env[key];
        }
    });

    test('returns undefined when no proxy is configured', () => {
        assert.strictEqual(getProxyAgent('https://management.azure.com'), undefined);
    });

    test('returns undefined for an invalid URL', () => {
        assert.strictEqual(getProxyAgent('not a url'), undefined);
    });

    test('returns an HttpsProxyAgent for https requests when HTTPS_PROXY is set', () => {
        process.env.HTTPS_PROXY = 'http://127.0.0.1:8888';
        const agent = getProxyAgent('https://management.azure.com/subscriptions');
        assert.ok(agent instanceof HttpsProxyAgent, 'expected an HttpsProxyAgent');
    });

    test('returns an HttpProxyAgent for http requests when HTTP_PROXY is set', () => {
        process.env.HTTP_PROXY = 'http://127.0.0.1:8888';
        const agent = getProxyAgent('http://example.com/');
        assert.ok(agent instanceof HttpProxyAgent, 'expected an HttpProxyAgent');
    });

    test('prefers HTTP_PROXY over HTTPS_PROXY for http: requests', () => {
        process.env.HTTP_PROXY = 'http://127.0.0.1:1111';
        process.env.HTTPS_PROXY = 'http://127.0.0.1:2222';
        const agent = getProxyAgent('http://example.com/') as HttpProxyAgent<string>;
        assert.ok(agent instanceof HttpProxyAgent, 'expected an HttpProxyAgent');
        assert.strictEqual(agent.proxy.port, '1111');
    });

    test('falls back to ALL_PROXY when the protocol-specific var is unset', () => {
        process.env.ALL_PROXY = 'http://127.0.0.1:3333';
        const agent = getProxyAgent('https://management.azure.com/') as HttpsProxyAgent<string>;
        assert.ok(agent instanceof HttpsProxyAgent, 'expected an HttpsProxyAgent');
        assert.strictEqual(agent.proxy.port, '3333');
    });

    test('returns undefined for non-http(s) schemes even when a proxy is set', () => {
        process.env.HTTPS_PROXY = 'http://127.0.0.1:8888';
        process.env.HTTP_PROXY = 'http://127.0.0.1:8888';
        process.env.ALL_PROXY = 'http://127.0.0.1:8888';
        assert.strictEqual(getProxyAgent('ftp://example.com/file'), undefined);
        assert.strictEqual(getProxyAgent('file:///tmp/x'), undefined);
    });

    test('honors NO_PROXY bypass', () => {
        process.env.HTTPS_PROXY = 'http://127.0.0.1:8888';
        process.env.NO_PROXY = '.azure.com';
        assert.strictEqual(getProxyAgent('https://management.azure.com/subscriptions'), undefined);
    });
});

suite('getProxySettings', () => {
    const savedEnv: Record<string, string | undefined> = {};
    const httpConfig = () => vscode.workspace.getConfiguration('http');

    suiteSetup(() => {
        for (const key of proxyEnvVars) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });

    suiteTeardown(() => {
        for (const key of proxyEnvVars) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedEnv[key];
            }
        }
    });

    teardown(() => {
        for (const key of proxyEnvVars) {
            delete process.env[key];
        }
    });

    test('returns undefined when no proxy is configured', () => {
        assert.strictEqual(getProxySettings('https://management.azure.com'), undefined);
    });

    test('returns undefined for an invalid URL', () => {
        assert.strictEqual(getProxySettings('not a url'), undefined);
    });

    test('returns ProxySettings when HTTPS_PROXY is set', () => {
        process.env.HTTPS_PROXY = 'http://127.0.0.1:8888';
        const settings = getProxySettings('https://management.azure.com/subscriptions');
        assert.ok(settings, 'expected ProxySettings');
        assert.strictEqual(settings?.host, 'http://127.0.0.1');
        assert.strictEqual(settings?.port, 8888);
    });

    test('honors NO_PROXY bypass', () => {
        process.env.HTTPS_PROXY = 'http://127.0.0.1:8888';
        process.env.NO_PROXY = '.azure.com';
        assert.strictEqual(getProxySettings('https://management.azure.com/subscriptions'), undefined);
    });

    test('returns undefined when http.proxySupport is off', async () => {
        process.env.HTTPS_PROXY = 'http://127.0.0.1:8888';
        const previous = httpConfig().inspect('proxySupport')?.globalValue;
        await httpConfig().update('proxySupport', 'off', vscode.ConfigurationTarget.Global);
        try {
            assert.strictEqual(getProxySettings('https://management.azure.com/subscriptions'), undefined);
        } finally {
            await httpConfig().update('proxySupport', previous, vscode.ConfigurationTarget.Global);
        }
    });
});

suite('ProxyAgentPolicy', () => {
    const savedEnv: Record<string, string | undefined> = {};
    const httpConfig = () => vscode.workspace.getConfiguration('http');

    async function withHttpSetting<T>(key: string, value: unknown, callback: () => Promise<T> | T): Promise<T> {
        const previous = httpConfig().inspect(key)?.globalValue;
        await httpConfig().update(key, value, vscode.ConfigurationTarget.Global);
        try {
            return await callback();
        } finally {
            await httpConfig().update(key, previous, vscode.ConfigurationTarget.Global);
        }
    }

    async function runPolicy(url: string): Promise<ReturnType<typeof createPipelineRequest>> {
        const policy = new ProxyAgentPolicy();
        const request = createPipelineRequest({ method: 'GET', url });
        await policy.sendRequest(request, () => Promise.resolve({} as PipelineResponse));
        return request;
    }

    suiteSetup(() => {
        for (const key of proxyEnvVars) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });

    suiteTeardown(() => {
        for (const key of proxyEnvVars) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedEnv[key];
            }
        }
    });

    test('injects proxySettings from http.proxy for a secure proxy', async () => {
        await withHttpSetting('proxy', 'http://127.0.0.1:8888', async () => {
            const request = await runPolicy('https://management.azure.com/subscriptions');
            assert.ok(request.proxySettings, 'expected proxySettings to be set');
            assert.strictEqual(request.proxySettings?.port, 8888);
            assert.strictEqual(request.agent, undefined, 'secure proxy should defer agent creation to the built-in policy');
        });
    });

    test('sets an insecure proxy agent when proxyStrictSSL is false', async () => {
        await withHttpSetting('proxy', 'http://127.0.0.1:8888', async () => {
            await withHttpSetting('proxyStrictSSL', false, async () => {
                const request = await runPolicy('https://management.azure.com/subscriptions');
                assert.ok(request.agent instanceof HttpsProxyAgent, 'expected an HttpsProxyAgent');
            });
        });
    });

    test('sets an insecure TLS agent when proxyStrictSSL is false and no proxy is set', async () => {
        await withHttpSetting('proxy', '', async () => {
            await withHttpSetting('proxyStrictSSL', false, async () => {
                const request = await runPolicy('https://management.azure.com/subscriptions');
                assert.ok(request.agent instanceof HttpsAgent, 'expected an https.Agent');
                assert.ok(!(request.agent instanceof HttpsProxyAgent), 'should not be a proxy agent');
            });
        });
    });

    test('respects an agent set by the caller', async () => {
        await withHttpSetting('proxy', 'http://127.0.0.1:8888', async () => {
            const policy = new ProxyAgentPolicy();
            const callerAgent = new HttpsAgent();
            const request = createPipelineRequest({ method: 'GET', url: 'https://management.azure.com/' });
            request.agent = callerAgent;
            await policy.sendRequest(request, () => Promise.resolve({} as PipelineResponse));
            assert.strictEqual(request.agent, callerAgent);
            assert.strictEqual(request.proxySettings, undefined);
        });
    });

    test('honors http.noProxy bypass', async () => {
        await withHttpSetting('proxy', 'http://127.0.0.1:8888', async () => {
            await withHttpSetting('noProxy', ['.azure.com'], async () => {
                const request = await runPolicy('https://management.azure.com/subscriptions');
                assert.strictEqual(request.proxySettings, undefined);
                assert.strictEqual(request.agent, undefined);
            });
        });
    });

    test('ignores non-http(s) request URLs', async () => {
        await withHttpSetting('proxy', 'http://127.0.0.1:8888', async () => {
            const request = await runPolicy('ftp://example.com/file');
            assert.strictEqual(request.proxySettings, undefined);
            assert.strictEqual(request.agent, undefined);
        });
    });

    test('ignores http.proxy when http.proxySupport is off', async () => {
        await withHttpSetting('proxy', 'http://127.0.0.1:8888', async () => {
            await withHttpSetting('proxySupport', 'off', async () => {
                const request = await runPolicy('https://management.azure.com/subscriptions');
                assert.strictEqual(request.proxySettings, undefined);
                assert.strictEqual(request.agent, undefined);
                assert.strictEqual(getProxyAgent('https://management.azure.com/subscriptions'), undefined);
            });
        });
    });

    test('fully no-ops when http.proxySupport is off even if proxyStrictSSL is false', async () => {
        await withHttpSetting('proxy', 'http://127.0.0.1:8888', async () => {
            await withHttpSetting('proxySupport', 'off', async () => {
                await withHttpSetting('proxyStrictSSL', false, async () => {
                    const request = await runPolicy('https://management.azure.com/subscriptions');
                    assert.strictEqual(request.proxySettings, undefined);
                    assert.strictEqual(request.agent, undefined);
                    assert.strictEqual(getProxyAgent('https://management.azure.com/subscriptions'), undefined);
                });
            });
        });
    });
});

suite('ProxyAgentPolicy TLS enforcement (integration)', () => {
    const savedEnv: Record<string, string | undefined> = {};
    const httpConfig = () => vscode.workspace.getConfiguration('http');

    let destServer: HttpsServer;
    let connectProxy: HttpServer;
    let destPort = 0;
    let proxyUrl = '';
    // Track every socket so teardown can force-close them; keep-alive proxy agents and the CONNECT
    // tunnel otherwise leave sockets open and server.close() would hang.
    const openSockets = new Set<Socket>();

    function track(socket: Socket): void {
        openSockets.add(socket);
        socket.on('close', () => { openSockets.delete(socket); });
    }

    async function withHttpSetting<T>(key: string, value: unknown, callback: () => Promise<T> | T): Promise<T> {
        const previous = httpConfig().inspect(key)?.globalValue;
        await httpConfig().update(key, value, vscode.ConfigurationTarget.Global);
        try {
            return await callback();
        } finally {
            await httpConfig().update(key, previous, vscode.ConfigurationTarget.Global);
        }
    }

    // Issues an HTTPS GET to the self-signed destination server through the given proxy agent,
    // resolving with the response body or rejecting with the connection/TLS error. This exercises the
    // real destination TLS handshake inside the CONNECT tunnel, which is what the strictSSL override
    // has to reach.
    function requestThroughProxy(agent: HttpsProxyAgent<string>): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const request = httpsGet({ hostname: '127.0.0.1', port: destPort, path: '/', agent }, (response) => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', (chunk: string) => { body += chunk; });
                response.on('end', () => resolve(body));
            });
            request.on('error', reject);
        });
    }

    suiteSetup(async () => {
        for (const key of proxyEnvVars) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }

        // Self-signed HTTPS destination whose certificate does not chain to any trusted root.
        destServer = createHttpsServer({ key: SELF_SIGNED_KEY, cert: SELF_SIGNED_CERT }, (_request, response) => response.end('ok'));
        destServer.on('connection', track);
        await new Promise<void>((resolve) => destServer.listen(0, '127.0.0.1', resolve));
        destPort = (destServer.address() as AddressInfo).port;

        // Plain HTTP CONNECT proxy that blindly tunnels to the requested host:port, so the destination
        // TLS handshake happens end-to-end through the tunnel (the scenario a TLS-inspecting corporate
        // proxy creates).
        connectProxy = createHttpServer();
        connectProxy.on('connection', track);
        connectProxy.on('connect', (request, clientSocket, head) => {
            const [host, port] = (request.url ?? '').split(':');
            const upstream = netConnect(Number(port), host, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                upstream.write(head);
                upstream.pipe(clientSocket);
                clientSocket.pipe(upstream);
            });
            track(upstream);
            upstream.on('error', () => clientSocket.destroy());
            clientSocket.on('error', () => upstream.destroy());
        });
        await new Promise<void>((resolve) => connectProxy.listen(0, '127.0.0.1', resolve));
        proxyUrl = `http://127.0.0.1:${(connectProxy.address() as AddressInfo).port}`;
    });

    suiteTeardown(async () => {
        for (const key of proxyEnvVars) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedEnv[key];
            }
        }
        for (const socket of openSockets) {
            socket.destroy();
        }
        openSockets.clear();
        await new Promise<void>((resolve) => destServer.close(() => resolve()));
        await new Promise<void>((resolve) => connectProxy.close(() => resolve()));
    });

    // Regression test for the headline scenario: without relaxing destination TLS, this request fails
    // with DEPTH_ZERO_SELF_SIGNED_CERT even though the user opted out via http.proxyStrictSSL:false.
    test('getProxyAgent relaxes destination TLS through the proxy when proxyStrictSSL is false', async () => {
        await withHttpSetting('proxy', proxyUrl, async () => {
            await withHttpSetting('proxyStrictSSL', false, async () => {
                const agent = getProxyAgent(`https://127.0.0.1:${destPort}/`);
                assert.ok(agent instanceof HttpsProxyAgent, 'expected an HttpsProxyAgent');
                assert.strictEqual(await requestThroughProxy(agent), 'ok');
            });
        });
    }).timeout(20000);

    // The default (strictSSL true) must still reject an untrusted destination certificate through the
    // proxy, proving the override only relaxes TLS when explicitly requested.
    test('getProxyAgent enforces destination TLS through the proxy by default (rejects self-signed cert)', async () => {
        await withHttpSetting('proxy', proxyUrl, async () => {
            const agent = getProxyAgent(`https://127.0.0.1:${destPort}/`);
            assert.ok(agent instanceof HttpsProxyAgent, 'expected an HttpsProxyAgent');
            await assert.rejects(
                requestThroughProxy(agent),
                (err: unknown) => {
                    const nodeErr = err as NodeJS.ErrnoException;
                    return nodeErr.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || /self.?signed certificate/i.test(nodeErr.message);
                },
                'expected a self-signed certificate error',
            );
        });
    }).timeout(20000);

    // The policy path (request.agent set by applyProxy) must also relax destination TLS, not just the
    // standalone getProxyAgent export.
    test('the insecure agent the policy sets on the request relaxes destination TLS', async () => {
        await withHttpSetting('proxy', proxyUrl, async () => {
            await withHttpSetting('proxyStrictSSL', false, async () => {
                const policy = new ProxyAgentPolicy();
                const request = createPipelineRequest({ method: 'GET', url: `https://127.0.0.1:${destPort}/` });
                await policy.sendRequest(request, () => Promise.resolve({} as PipelineResponse));
                assert.ok(request.agent instanceof HttpsProxyAgent, 'expected the policy to set an HttpsProxyAgent');
                assert.strictEqual(await requestThroughProxy(request.agent), 'ok');
            });
        });
    }).timeout(20000);
});
