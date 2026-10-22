// One room per tournament. Viewers (the beamer, phones, the organiser's screen) hold a WebSocket;
// after every change the API posts the new public view here and the room sends it to everyone.
// Uses the hibernation API, so quiet connections cost nothing. The last view is kept, so a new
// connection gets the current state at once.

import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

export class TournamentRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const view = await request.text();
      await this.ctx.storage.put('view', view);
      const message = JSON.stringify({ type: 'view', view: JSON.parse(view) });
      const sockets = this.ctx.getWebSockets();
      for (const ws of sockets) {
        try {
          ws.send(message);
        } catch {
          // Closed in the meantime; the runtime drops it.
        }
      }
      return Response.json({ viewers: sockets.length });
    }
    if (url.pathname === '/count') return Response.json({ viewers: this.ctx.getWebSockets().length });
    if (url.pathname === '/connect') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket.', { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const view = await this.ctx.storage.get<string>('view');
      if (view) server.send(JSON.stringify({ type: 'view', view: JSON.parse(view) }));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/forget' && request.method === 'POST') {
      // The tournament was deleted: tell everyone and close.
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(JSON.stringify({ type: 'deleted' }));
          ws.close(1000, 'deleted');
        } catch {
          // already closed
        }
      }
      await this.ctx.storage.deleteAll();
      return Response.json({ ok: true });
    }
    return new Response('Not found.', { status: 404 });
  }

  /** Clients send "ping" to keep proxies from closing idle connections. */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') ws.send('pong');
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      // already closed
    }
  }
}
