import crypto from 'node:crypto';
import { env } from '../config/env.js';
import type { Db } from '../db/pool.js';
import type { Settings } from './settings.js';

/**
 * Абстракция платёжного провайдера.
 *  - mock: демо-страница оплаты (для разработки и показа клиенту);
 *  - link: оплата по ссылке Kaspi/другого банка из настроек (подтверждает сотрудник).
 * Подключение реального эквайринга (Kaspi Pay, Halyk epay, CloudPayments и т.д.) = новый класс, реализующий PaymentProvider,
 * плюс вебхук с проверкой подписи (см. verifyWebhookSignature).
 */
export interface PaymentSession {
  provider: string;
  externalId: string;
  paymentUrl: string | null;
}

export interface PaymentProvider {
  name: string;
  create(orderPublicId: string, amount: number, settings: Settings): Promise<PaymentSession>;
}

class MockProvider implements PaymentProvider {
  name = 'mock';
  async create(orderPublicId: string): Promise<PaymentSession> {
    const externalId = `mock_${crypto.randomUUID()}`;
    return {
      provider: this.name,
      externalId,
      paymentUrl: `${env.publicUrl}/pay/mock/${externalId}?order=${orderPublicId}`,
    };
  }
}

class LinkProvider implements PaymentProvider {
  name = 'link';
  async create(_orderPublicId: string, _amount: number, settings: Settings): Promise<PaymentSession> {
    return { provider: this.name, externalId: `link_${crypto.randomUUID()}`, paymentUrl: settings.kaspi_link || null };
  }
}

export function getProvider(): PaymentProvider {
  return env.paymentProvider === 'link' ? new LinkProvider() : new MockProvider();
}

export async function startOnlinePayment(db: Db, orderId: number, orderPublicId: string, amount: number, settings: Settings) {
  const session = await getProvider().create(orderPublicId, amount, settings);
  await db.query(`INSERT INTO payments(order_id, provider, status, amount, external_id) VALUES ($1,$2,'pending',$3,$4)`, [
    orderId,
    session.provider,
    amount,
    session.externalId,
  ]);
  await db.query(`UPDATE orders SET payment_status = 'pending', updated_at = now() WHERE id = $1`, [orderId]);
  return session;
}

export function signWebhook(body: string): string {
  return crypto.createHmac('sha256', env.paymentWebhookSecret).update(body).digest('hex');
}

export function verifyWebhookSignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signWebhook(body));
  const got = Buffer.from(signature);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}
