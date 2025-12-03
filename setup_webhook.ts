// setup_webhook.ts
import 'dotenv/config';

interface WebhookConfig {
  url: string;
  max_connections?: number;
  drop_pending_updates?: boolean;
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: boolean;
  [key: string]: any;
}

/**
 * Set Telegram webhook
 */
async function setTelegramWebhook(
  token: string,
  url: string,
  maxConnections: number = 18,
  dropPendingUpdates: boolean = true
): Promise<TelegramResponse> {
  const telegramApiUrl = `https://api.telegram.org/bot${token}/setWebhook`;

  const payload: WebhookConfig = {
    url,
    max_connections: maxConnections,
    drop_pending_updates: dropPendingUpdates
  };

  const formData = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value.toString());
  });

  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    return await response.json();
  } catch (error) {
    console.error('Error setting webhook:', error);
    return { ok: false, description: 'Network error' };
  }
}

/**
 * Main function
 */
async function main() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  const webhookPath = '/whook';

  // Validate environment variables
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
  }

  let finalWebhookUrl: string;

  if (!WEBHOOK_URL) {
    console.log('WEBHOOK_URL is not set in .env file');
    const publicDomain = prompt('Enter your public domain (e.g., https://yourdomain.com): ')?.trim();

    if (!publicDomain) {
      console.error('❌ No domain provided');
      process.exit(1);
    }

    finalWebhookUrl = `${publicDomain}${webhookPath}`;
  } else {
    finalWebhookUrl = `${WEBHOOK_URL}${webhookPath}`;
  }

  console.log(`\nSetting webhook to: ${finalWebhookUrl}`);

  const result = await setTelegramWebhook(
    TELEGRAM_BOT_TOKEN,
    finalWebhookUrl,
    18,
    true
  );

  if (result.ok) {
    console.log('\n✅ Webhook set successfully!');
    console.log('Telegram response:', JSON.stringify(result, null, 2));
  } else {
    console.log('\n❌ Failed to set webhook.');
    console.log('Error:', result.description || 'Unknown error');
  }
}

// Run if this is the main module
if (import.meta.main) {
  main().catch(console.error);
}
