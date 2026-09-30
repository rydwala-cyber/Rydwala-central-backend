# Rydwala Central Backend — Deployment

## Environment
Set these on the hosting provider:

- `DATABASE_URL` = PostgreSQL connection string
- `JWT_SECRET` = long random secret (do not use the development fallback)
- `JWT_EXPIRES_IN=7d`
- `DEMO_MODE=false`
- `NODE_ENV=production`
- `PORT=3000` (or provider supplied port)
- `UPI_MERCHANT_ID` / `UPI_MERCHANT_NAME` when payment integration is enabled

## Health check
`GET /health`

## API base
`/api/v1`

## Important
The current release uses a durable PostgreSQL `entity_store` persistence layer for the existing service model. The normalized tables in `server/db/schema.sql` remain the target migration for the next hardening phase.
