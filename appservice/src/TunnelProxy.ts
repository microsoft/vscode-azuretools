/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { User } from 'azure-arm-website/lib/models';
import * as EventEmitter from 'events';
import { createServer, Server, Socket } from 'net';
import { OutputChannel } from 'vscode';
import * as websocket from 'websocket';
import { SiteClient } from './SiteClient';

/**
 * Wrapper for net.Socket that forwards all traffic to the Kudu tunnel websocket endpoint.
 * Used internally by the TunnelProxy server.
 */
class TunnelSocket extends EventEmitter {
    private _socket: Socket;
    private _client: SiteClient;
    private _publishCredential: User;
    private _outputChannel: OutputChannel;
    private _wsConnection: websocket.connection;
    private _wsClient: websocket.client;

    constructor(socket: Socket, client: SiteClient, publishCredential: User, outputChannel: OutputChannel) {
        super();
        this._socket = socket;
        this._client = client;
        this._publishCredential = publishCredential;
        this._outputChannel = outputChannel;
        this._wsClient = new websocket.client();
    }

    public connect(): void {
        this._outputChannel.appendLine('[Proxy Server] socket init');

        // Pause socket until tunnel connection has been established to make sure we don't lose data
        this._socket.pause();

        this._socket.on('data', (data: Buffer) => {
            this._outputChannel.appendLine('[Proxy Server] socket data');
            if (this._wsConnection) {
                this._wsConnection.send(data);
            }
        });

        this._socket.on('close', () => {
            this._outputChannel.appendLine(`[Proxy Server] client disconnected ${this._socket.remoteAddress}:${this._socket.remotePort}`);
            this.dispose();
            this.emit('close');
        });

        this._socket.on('error', (err: Error) => {
            this._outputChannel.appendLine(`[Proxy Server] socket error: ${err}`);
            this.dispose();
            this.emit('error', err);
        });

        this._wsClient.on('connect', (connection: websocket.connection) => {
            this._outputChannel.appendLine('[WebSocket] client connected');
            this._wsConnection = connection;

            // Resume socket after connection
            this._socket.resume();

            connection.on('close', () => {
                this._outputChannel.appendLine('[WebSocket] client closed');
                this.dispose();
                this.emit('close');
            });

            connection.on('error', (err: Error) => {
                this._outputChannel.appendLine(`[WebSocket] error: ${err}`);
                this.dispose();
                this.emit('error', err);
            });

            connection.on('message', (data: websocket.IMessage) => {
                this._outputChannel.appendLine('[WebSocket] data');
                this._socket.write(data.binaryData);
            });

        });

        this._wsClient.on('connectFailed', (err: Error) => {
            this._outputChannel.appendLine(`[WebSocket] connectFailed: ${err}`);
            this.dispose();
            this.emit('error', err);
        });

        this._wsClient.connect(
            `wss://${this._client.kuduHostName}/AppServiceTunnel/Tunnel.ashx`,
            undefined,
            undefined,
            { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
            { auth: `${this._publishCredential.publishingUserName}:${this._publishCredential.publishingPassword}` }
        );
    }

    public dispose(): void {
        this._outputChannel.appendLine('[Proxy Server] socket dispose');

        if (this._wsConnection) {
            this._wsConnection.close();
            this._wsConnection = undefined;
        }

        if (this._wsClient) {
            this._wsClient.abort();
            this._wsClient = undefined;
        }

        if (this._socket) {
            this._socket.destroy();
            this._socket = undefined;
        }
    }
}

/**
 * A local TCP server that forwards all connections to the Kudu tunnel websocket endpoint.
 */
export class TunnelProxy {
    private _port: number;
    private _client: SiteClient;
    private _publishCredential: User;
    private _outputChannel: OutputChannel;
    private _server: Server;
    private _openSockets: TunnelSocket[];

    constructor(port: number, client: SiteClient, publishCredential: User, outputChannel: OutputChannel) {
        this._port = port;
        this._client = client;
        this._publishCredential = publishCredential;
        this._outputChannel = outputChannel;
        this._server = createServer();
        this._openSockets = [];
    }

    public async startProxy(): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
            this._server.on('connection', (socket: Socket) => {
                const tunnelSocket: TunnelSocket = new TunnelSocket(socket, this._client, this._publishCredential, this._outputChannel);

                this._openSockets.push(tunnelSocket);
                tunnelSocket.on('close', () => {
                    const index: number = this._openSockets.indexOf(tunnelSocket);
                    if (index >= 0) {
                        this._openSockets.splice(index, 1);
                        this._outputChannel.appendLine(`[Proxy Server] client closed, connection count: ${this._openSockets.length}`);
                    }
                });

                tunnelSocket.connect();
                this._outputChannel.appendLine(`[Proxy Server] client connected ${socket.remoteAddress}:${socket.remotePort}, connection count: ${this._openSockets.length}`);
            });

            this._server.on('listening', () => {
                this._outputChannel.appendLine('[Proxy Server] start listening');
                resolve();
            });

            this._server.on('error', (err: Error) => {
                this._outputChannel.appendLine(`[Proxy Server] server error: ${err}`);
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

    public dispose(): void {
        this._openSockets.forEach((tunnelSocket: TunnelSocket) => {
            tunnelSocket.dispose();
        });
        this._server.close();
        this._server.unref();
    }
}
