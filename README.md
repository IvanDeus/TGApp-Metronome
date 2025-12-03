### TGApp-Metronome
# Telegram Mini App: Simple Metronome

A simple metronome mini app that runs inside **Telegram WebApp** environment using **Bun backend** and **SQLite** for storing user BPM preferences.

> Works only inside Telegram and requires HTTPS access.

---

## ✅ Features

- Runs in Telegram via WebApp
- Fetches Telegram user info
- Saves/loads BPM settings from SQLite
- Audio click metronome with easily adjustable tempo
- Works securely over HTTPS

---

## 📦 Requirements

### 💻 Local Development Tools

- bun 1.3.3
- Telegram account with bot created via BotFather

### ⚙️ Server Setup (for production)

- Linux (Ubuntu/RedHat or similar) server
- Nginx (or grok)
- Domain name with DNS configured

---

## 🛠️ Installation Instructions

### Step 1: Get the App

Download a release file and unpack:

```
git clone release-name
```

### Step 2: Create Environment & Install Dependencies

Depending on your OS, install bun main package:
```
curl -fsSL https://bun.sh/install | bash
```
### Step 3: 🤖Set Up Your Telegram Bot

3.1. Open Telegram and search for @BotFather

3.2. Run /newbot and follow the instructions

3.3. Save the token provided — this is your TELEGRAM_BOT_TOKEN

3.4. Go to Bot settings - Configure Mini App - Add Mini App URL (Webhook URL)

### Step 4: Configure App

Create your configuration file:

```
cd TGApp-Metronome/
cp dotenv-example .env
nano .env
```
Edit .env and add your actual data, like: TELEGRAM_BOT_TOKEN, App URL and local port for a webhook.

### Step 5: Set Up Webhook 

Run this to connect your Telegram bot to your App:

`bun run setup_webhook.py`

### Step 6: 🏃🏻‍♂️Run Your Metronome Mini App

To start the App in the background run: 

`bun run app.ts`

This step will also initialize the SQLite database.

### Step 7: Expose App Publicly

Use Nginx (Recommended for Production) for proxying public URL to a local App port, similar to this:

```
server {
    listen 443 ssl;
    server_name yourdomain.com;
    ssl_certificate /home/user/chain.cer;
    ssl_certificate_key /home/user/cert.key;

    location / {
        proxy_pass http://localhost:5555;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

You can get SSL Certificate from Certbot/acme.sh "Let's Encrypt" or any other provider.

### Step 8: 🎉Enjoy!

Go to your Telegram bot and run the App!


2025 [ ivan deus ]
