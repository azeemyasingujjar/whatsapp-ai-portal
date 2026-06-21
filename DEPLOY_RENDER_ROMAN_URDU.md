# Render Par Deploy Karne Ka Simple Tareeqa

Ye project Render par chalane ke liye ready hai. Customer ko kuch buy nahi karna. Sirf owner yani aap Render par paid service chalayenge.

## Zaroori Baat

Netlify/Vercel/simple static hosting par ye system 24/7 WhatsApp reply ke liye theek nahi hai. Is project ko always-on Node.js server, Chrome/Chromium, aur persistent disk chahiye.

## Files Ready Hain

- `Dockerfile` - cloud server me Node.js aur Chromium install karega.
- `render.yaml` - Render service, env vars, aur persistent disk setup karega.
- `DATA_DIR=/var/data` - WhatsApp sessions aur app data persistent disk me save honge.

## Step 1: GitHub Private Repo

1. GitHub par new private repository banayein.
2. Is folder ka code upload karein.
3. `.env`, `service-account.json`, `data`, `node_modules` upload nahi karne.

## Step 2: Render Service

1. Render.com par login karein.
2. New > Blueprint ya New > Web Service choose karein.
3. GitHub repo connect karein.
4. Agar `render.yaml` detect ho jaye to blueprint use karein.
5. Plan `Starter` se start karein. Zyada WhatsApp accounts ke liye baad me Standard/Pro kar sakte hain.

## Step 3: Environment Variables

Render dashboard me ye values set karein:

```text
DATA_DIR=/var/data
FORGOT_WHATSAPP_NUMBER=+923357631909
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SHEET_RANGE=Users!A:E
GOOGLE_SERVICE_ACCOUNT_JSON=your_full_service_account_json
```

`APP_SECRET` aur `DATA_SECRET` strong random value honi chahiye. `DATA_SECRET` deploy ke baad change na karein, warna saved API keys decrypt nahi hongi.

## Step 4: Google Sheet

Google Sheet ki columns:

```text
email | password | expires_at | status | name
```

Sheet ko service account email ke sath share karein.

## Step 5: Test

1. Render URL open karein.
2. Login karein.
3. WhatsApp page par `NEW ACCOUNT` ya `LINK ACCOUNT` click karein.
4. QR scan karein.
5. API Builder me customer ki API key add karein.
6. Actions me WhatsApp account + API attach karein.
7. Website logout/browser band karke WhatsApp par message bhej kar test karein.

## Important

Website logout karne se WhatsApp logout nahi hoga. WhatsApp sirf tab logout hoga jab user portal me Disconnect/Logout WhatsApp kare, ya mobile WhatsApp linked devices se logout kare.
