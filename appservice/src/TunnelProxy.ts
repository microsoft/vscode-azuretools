/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { User } from 'azure-arm-website/lib/models';
import * as EventEmitter from 'events';
import { createServer, Server, Socket } from 'net';
import * as request from 'request';
import * as websocket from 'websocket';
import { ext } from './extensionVariables';
import { SiteClient } from './SiteClient';

/**
 * Wrapper for net.Socket that forwards all traffic to the Kudu tunnel websocket endpoint.
 * Used internally by the TunnelProxy server.
 */
class TunnelSocket extends EventEmitter {
    private _socket: Socket;
    private _client: SiteClient;
    private _publishCredential: User;
    private _wsConnection: websocket.connection | undefined;
    private _wsClient: websocket.client;

    constructor(socket: Socket, client: SiteClient, publishCredential: User) {
        super();
        this._socket = socket;
        this._client = client;
        this._publishCredential = publishCredential;
        this._wsClient = new websocket.client();
    }

    public connect(): void {
        ext.outputChannel.appendLine('[Proxy Server] socket init');

        // Pause socket until tunnel connection has been established to make sure we don't lose data
        this._socket.pause();

        this._socket.on('data', (data: Buffer) => {
            if (this._wsConnection) {
                this._wsConnection.send(data);
            }
        });

        this._socket.on('close', () => {
            ext.outputChannel.appendLine(`[Proxy Server] client disconnected ${this._socket.remoteAddress}:${this._socket.remotePort}`);
            this.dispose();
            this.emit('close');
        });

        this._socket.on('error', (err: Error) => {
            ext.outputChannel.appendLine(`[Proxy Server] socket error: ${err}`);
            this.dispose();
            this.emit('error', err);
        });

        this._wsClient.on('connect', (connection: websocket.connection) => {
            ext.outputChannel.appendLine('[WebSocket] client connected');
            this._wsConnection = connection;

            // Resume socket after connection
            this._socket.resume();

            connection.on('close', () => {
                ext.outputChannel.appendLine('[WebSocket] client closed');
                this.dispose();
                this.emit('close');
            });

            connection.on('error', (err: Error) => {
                ext.outputChannel.appendLine(`[WebSocket] error: ${err}`);
                this.dispose();
                this.emit('error', err);
            });

            connection.on('message', (data: websocket.IMessage) => {
                this._socket.write(data.binaryData);
            });

        });

        this._wsClient.on('connectFailed', (err: Error) => {
            ext.outputChannel.appendLine(`[WebSocket] connectFailed: ${err}`);
            this.dispose();
            this.emit('error', err);
        });

        this._wsClient.connect(
            `wss://${this._client.kuduHostName}/AppServiceTunnel/Tunnel.ashx`,
            undefined,
            undefined,
            {
                'User-Agent': 'vscode-azuretools',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache'
            },
            {
                auth: `${this._publishCredential.publishingUserName}:${this._publishCredential.publishingPassword}`
            }
        );
    }

    public dispose(): void {
        ext.outputChannel.appendLine('[Proxy Server] socket dispose');

        if (this._wsConnection) {
            this._wsConnection.close();
            this._wsConnection = undefined;
        }

        this._wsClient.abort();

        this._socket.destroy();
    }
}

/**
 * Interface for tunnel GetStatus API
 */
enum WebAppState {
    STARTED = 'STARTED',
    STARTING = 'STARTING',
    STOPPED = 'STOPPED'
}

interface ITunnelStatus {
    port: number;
    canReachPort: boolean;
    state: WebAppState;
    msg: string;
}

/**
 * Internal interface to communicate tunnel status checking failures
 */
interface ICheckTunnelStatusFailure {
    shouldRetry: boolean;
    message: string;
}

/**
 * A local TCP server that forwards all connections to the Kudu tunnel websocket endpoint.
 */
export class TunnelProxy {
    private _port: number;
    private _client: SiteClient;
    private _publishCredential: User;
    private _server: Server;
    private _openSockets: TunnelSocket[];

    constructor(port: number, client: SiteClient, publishCredential: User) {
        this._port = port;
        this._client = client;
        this._publishCredential = publishCredential;
        this._server = createServer();
        this._openSockets = [];
    }

    public async startProxy(): Promise<void> {
        await this.checkTunnelStatusWithRetry();
        await this.setupTunnelServer();
    }

    public dispose(): void {
        this._openSockets.forEach((tunnelSocket: TunnelSocket) => {
            tunnelSocket.dispose();
        });
        this._server.close();
        this._server.unref();
    }

    private async checkTunnelStatus(): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (failure: ICheckTunnelStatusFailure) => void): void => {
            const statusOptions: request.Options = {
                uri: `https://${this._client.kuduHostName}/AppServiceTunnel/Tunnel.ashx?GetStatus&GetStatusAPIVer=2`,
                headers: {
                    'User-Agent': 'vscode-azuretools'
                },
                auth: {
                    user: this._publishCredential.publishingUserName,
                    pass: this._publishCredential.publishingPassword
                }
            };

            const statusCallback: request.RequestCallback = (error: string, response: request.Response, body: string): void => {
                if (error) {
                    reject({ shouldRetry: false, message: `Error getting tunnel status: ${error}` });
                } else if (response.statusCode === 200) {
                    ext.outputChannel.appendLine(`[WebApp Tunnel] Checking status, body: ${body}`);

                    const tunnelStatus: ITunnelStatus = JSON.parse(body);

                    if (tunnelStatus.state === WebAppState.STARTED) {
                        if (tunnelStatus.port === 2222) {
                            // Tunnel is pointed to default SSH port and still needs time to restart
                            reject({ shouldRetry: true, message: 'WebApp is waiting for restart' });
                        } else if (tunnelStatus.canReachPort) {
                            resolve();
                        } else {
                            reject({ shouldRetry: false, message: 'WebApp is started, but port is unreachable' });
                        }
                    } else if (tunnelStatus.state === WebAppState.STARTING) {
                        reject({ shouldRetry: true, message: 'WebApp is starting' });
                    } else if (tunnelStatus.state === WebAppState.STOPPED) {
                        reject({ shouldRetry: false, message: 'WebApp is stopped, try sending a request to start it up' });
                    } else {
                        reject({ shouldRetry: false, message: `Unexpected WebApp state: ${tunnelStatus.state}` });
                    }
                } else {
                    reject({ shouldRetry: false, message: `Unexpected response getting tunnel status: ${response.statusCode} - ${response.statusMessage}` });
                }
            };

            request.get(statusOptions, statusCallback);
        });
    }

    private async checkTunnelStatusWithRetry(): Promise<void> {
        const timeoutSeconds: number = 240; // 4 minutes, matches App Service internal timeout for starting up an app
        const timeoutMs: number = timeoutSeconds * 1000;
        const pollingIntervalMs: number = 5000;

        const delay: (delayMs: number) => Promise<void> = async (delayMs: number): Promise<void> => {
            await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, delayMs); });
        };

        return new Promise<void>(async (resolve: () => void, reject: (error: Error) => void): Promise<void> => {
            const start: number = Date.now();
            while (Date.now() < start + timeoutMs) {
                try {
                    await this.checkTunnelStatus();
                    resolve();
                    return;
                } catch (error) {
                    const checkFailure: ICheckTunnelStatusFailure = error;
                    if (!checkFailure.shouldRetry) {
                        reject(new Error(`Unable to establish connection to application: ${checkFailure.message}`));
                        return;
                    } // else allow retry
                }

                await delay(pollingIntervalMs);
            }
            reject(new Error(`Unable to establish connection to application: Timed out after ${timeoutSeconds} seconds`));
        });
    }

    private async setupTunnelServer(): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
            this._server.on('connection', (socket: Socket) => {
                const tunnelSocket: TunnelSocket = new TunnelSocket(socket, this._client, this._publishCredential);

                this._openSockets.push(tunnelSocket);
                tunnelSocket.on('close', () => {
                    const index: number = this._openSockets.indexOf(tunnelSocket);
                    if (index >= 0) {
                        this._openSockets.splice(index, 1);
                        ext.outputChannel.appendLine(`[Proxy Server] client closed, connection count: ${this._openSockets.length}`);
                    }
                });

                tunnelSocket.connect();
                ext.outputChannel.appendLine(`[Proxy Server] client connected ${socket.remoteAddress}:${socket.remotePort}, connection count: ${this._openSockets.length}`);
            });

            this._server.on('listening', () => {
                ext.outputChannel.appendLine('[Proxy Server] start listening');
                resolve();
            });

            this._server.on('error', (err: Error) => {
                ext.outputChannel.appendLine(`[Proxy Server] server error: ${err}`);
                this.dispose();
                reject(err);
            });

            this._server.listen({
                host: 'localhost',
                port: this._port,
                backlog: 1
            });
        });
    }
}
