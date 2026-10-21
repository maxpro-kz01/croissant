# API

Базовый путь `/api`. Админские маршруты требуют `Authorization: Bearer <token>` (для SSE — `?token=`).

## Публичные
| Метод | Путь | Описание |
|---|---|---|
| GET | `/menu` | категории, акции, публичные настройки, `is_open` |
| GET | `/tables/:code` | номер стола по коду из QR |
| POST | `/orders` | создать заказ (цены считает сервер), ответ содержит ссылку WhatsApp и `payment_url` |
| GET | `/orders/:publicId` | статус заказа для гостя |
| POST | `/auth/login` | вход, возвращает JWT |
| POST | `/payments/webhook` | вебхук провайдера, подпись HMAC в `x-signature` |
| POST | `/payments/mock/:externalId/confirm` | демо-оплата (только `PAYMENT_PROVIDER=mock`) |

## Сотрудники и админ (`/admin`)
- `GET /orders?status=active|…&type=&table=&date=`, `PATCH /orders/:id/status`, `PATCH /orders/:id/payment`
- `GET /hall`, `GET /stream` (SSE: `order.created`, `order.updated`)
- Смены: `GET /shifts/current`, `GET /shifts`, `POST /shifts/open|close|cash`

## Только админ
- Меню: `GET /menu`, `POST|PUT|DELETE /categories`, `POST|PUT|DELETE /items`, `PATCH /items/:id/availability`, `/banners`
- Столы: `GET|POST /tables`, `DELETE /tables/:id`, `GET /tables/:id/qr[?format=svg]`
- `GET /reports`, `GET /reports/export.csv`, `GET|PUT /settings`, `GET|POST|DELETE /users`

Ошибки: `{ "error": "...", "code": "closed|min_order|item_unavailable|…" }`.
