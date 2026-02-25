# Bitespeed Identity Reconciliation

Backend service for the Bitespeed assessment task: reconcile customer identities across multiple orders using email and/or phone number.

## Live API

- `POST https://<your-deployed-domain>/identify`

Example:
- `POST https://bitespeed-identity.onrender.com/identify`

## Tech Stack

- Node.js
- TypeScript
- Express.js
- SQLite (`better-sqlite3`)

## Project Structure

- `src/index.ts` - app bootstrap and routes
- `src/routes/identify.ts` - `/identify` endpoint
- `src/services/contactService.ts` - reconciliation logic
- `src/db/database.ts` - DB setup and schema
- `src/types/index.ts` - request/response types

## Setup (Local)

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build:
```bash
npm run build
```

4. Start production build:
```bash
npm start
```

App runs on:
- `http://localhost:3000`

Health check:
- `GET /health`

## API

### `POST /identify`

Request body (at least one field required):
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Both are optional individually, but not both missing/null/empty.

### Success Response (`200`)

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

### Validation Error (`400`)

```json
{
  "error": "Bad Request",
  "message": "Provide at least one of 'email' or 'phoneNumber'."
}
```

## Reconciliation Rules Implemented

1. If no matching contact exists by email/phone, create a new `primary` contact.
2. Contacts are linked if they share either email or phone.
3. If request contains new info for an existing identity cluster, create a `secondary` contact.
4. If request connects two primary clusters, the oldest primary remains primary.
5. Newer primary is demoted to secondary and its secondaries are re-linked to the true primary.
6. Response always returns:
   - primary contact id
   - unique emails (primary first)
   - unique phone numbers (primary first)
   - all secondary contact ids

## cURL Test Cases

Create new primary:
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"doc@hillvalley.edu\",\"phoneNumber\":\"88888\"}"
```

Create secondary (same phone, new email):
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"emmett@hillvalley.edu\",\"phoneNumber\":\"88888\"}"
```

## Deployment (Render)

1. Push code to GitHub.
2. Create a new Web Service on Render.
3. Use:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Deploy and copy your domain.
5. Update **Live API** section with your final endpoint.

## Submission Checklist

- GitHub repository link
- Deployed endpoint (`/identify`)
- README updated with live URL
- JSON request/response examples included
