import type { Request, Response } from 'express';

type Client = { id: number; res: Response };

/** Простой SSE-хаб: сотрудники подписываются на события заказов в реальном времени. */
export class Hub {
  private clients = new Set<Client>();
  private seq = 0;

  subscribe(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    const client: Client = { id: ++this.seq, res };
    this.clients.add(client);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(ping);
      this.clients.delete(client);
    });
  }

  emit(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.res.write(payload);
  }

  get size() {
    return this.clients.size;
  }
}
