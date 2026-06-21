# WhatsApp AI Portal

Focused cloud portal with four visible modules:

- Messenger
- Actions to attach WhatsApp with an API
- WhatsApp scan/linking
- API builder with API key, initial prompt, and post prompt
- WhatsApp voice note transcription before AI reply

Extra backend support:

- Google Sheet based login with expiry date
- Forgot password WhatsApp contact message

## Setup

1. Install Node.js 20 or newer.
2. Open this folder in terminal.
3. Install Google Chrome on the server.
4. Run `pnpm install --prod --ignore-scripts` or `npm install --ignore-scripts`.
5. Copy `.env.example` to `.env`.
6. Fill `.env` values.
7. Run `npm start`.
8. Open `http://localhost:3030`.

If Chrome is not detected automatically, set `CHROME_PATH` in `.env`.

## Google Sheet Login

Create a Google Sheet with this first row:

```text
email | password | expires_at | status | name
```

Example:

```text
user@example.com | 12345 | 2026-12-31 | active | User Name
```

Then set:

```text
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SHEET_RANGE=Users!A:E
GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json
```

Share the Google Sheet with the service account email.

## Cloud Note

Deploy this on a VPS or cloud server with persistent storage. If your laptop internet is off, replies still continue as long as the cloud server is online, WhatsApp is linked, and the API key is valid.

Avoid free hosts that sleep, because WhatsApp sessions and automatic replies can stop when the server sleeps.

## OpenAI

The app calls the OpenAI Responses API at:

```text
https://api.openai.com/v1/responses
```

Each AI key can set model, initial prompt, post prompt, max tokens, and history threshold.

Voice notes are transcribed with:

```text
https://api.openai.com/v1/audio/transcriptions
```

Default transcription model:

```text
gpt-4o-mini-transcribe
```

Keep `Transcription` enabled in API Builder if you want WhatsApp voice notes to be read before auto-reply.

## Production Checklist

- Set strong `APP_SECRET` and `DATA_SECRET`.
- Use HTTPS on the cloud server.
- Keep `data/wa-session` persistent.
- Keep `.env` private.
- Rotate any API key that was visible in screenshots.
- Use this only for customers who expect replies from your business.
