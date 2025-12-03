// app.ts
import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import { Bot, webhookCallback } from 'grammy';
import { fileURLToPath } from 'url';
import { Database } from 'bun:sqlite';
import { createHmac } from 'node:crypto';

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Config variables (replace with your actual values or use process.env)
const TELEGRAM_BOT_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_LPORT: number = parseInt(process.env.BOT_LPORT || '5000', 10);
const DATABASE: string = process.env.DATABASE || 'database.sqlite';

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

// Initialize database
const db = new Database(DATABASE);

// Initialize database schema if it doesn't exist
function init_db() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`Loading schema from ${schemaPath}`);
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('Database initialized.');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Integrity check
function verify_telegram_data(data: Record<string, string>): boolean {
  const received_hash = data.hash || '';
  delete data.hash;

  const data_check_arr: string[] = [];
  const keys = Object.keys(data).sort();
  for (const key of keys) {
    let value = data[key];
    if (typeof value === 'string' && value.includes('\n')) {
      // Note: Only escape if necessary
    }
    data_check_arr.push(`${key}=${value}`);
  }
  const data_check_string = data_check_arr.join('\n');

  const secret_key = createHmac('sha256', 'WebAppData')
    .update(TELEGRAM_BOT_TOKEN)
    .digest();

  const calculated_hash = createHmac('sha256', secret_key)
    .update(data_check_string)
    .digest('hex');

  //console.log('Calculated hash:', calculated_hash);
  //console.log('Received hash:', received_hash);

  return calculated_hash === received_hash;
}

// Main web page
app.get('/', (req: Request, res: Response) => {
  console.log('Serving /');
  res.sendFile(path.join(__dirname, 'static/load.html'));
});

// Get initial user data from app
app.post('/init_telegram', (req: Request, res: Response) => {
  console.log('Received POST /init_telegram');
  const raw_data = req.body.initData || '';
  if (!raw_data) {
    console.warn('Missing initData');
    return res.status(400).json({ error: 'Missing initData' });
  }

  try {
    //console.log('Raw initData:', raw_data);
    const params = new URLSearchParams(raw_data);
    const data_dict: Record<string, string> = {};
    for (const [k, v] of params) {
      data_dict[k] = v;
    }
    //console.log('Parsed data:', data_dict);

    if (!verify_telegram_data(data_dict)) {
      console.warn('Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (!data_dict.user) {
      console.warn('Missing user');
      return res.status(400).json({ error: 'Missing user in initData' });
    }

    const user_data = JSON.parse(data_dict.user);
    //console.log('User data:', user_data);
    const user_id: number = user_data.id;
    const first_name: string = user_data.first_name || 'Unknown';
    const last_name: string = user_data.last_name || '';
    const username: string = user_data.username || '';
    const language_code: string = user_data.language_code || 'en';
    const is_premium: boolean = user_data.is_premium || false;
    const photo_url: string = user_data.photo_url || '';

    // Check if user exists
    const selectStmt = db.query('SELECT * FROM telegram_users WHERE user_id = ?');
    const existing_user = selectStmt.get(user_id);
    console.log('Existing user:', !!existing_user);

    if (!existing_user) {
      const insertStmt = db.query(`
        INSERT INTO telegram_users (
          user_id, telegram_id, is_bot, first_name, last_name, username,
          language_code, is_premium, photo_url, bpm, is_subbed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        user_id, user_id, user_data.is_bot || false,
        first_name, last_name, username,
        language_code, is_premium, photo_url,
        90, 0
      );
      console.log('User inserted');
    } else {
      const updateStmt = db.query(`
        UPDATE telegram_users SET
          first_name = ?,
          username = ?,
          photo_url = ?
        WHERE user_id = ?
      `);
      updateStmt.run(first_name, username, photo_url, user_id);
      console.log('User updated');
    }

    // Get BPM
    const bpmRow = selectStmt.get(user_id);
    const bpm: number = bpmRow.bpm;

    return res.json({
      user_id,
      first_name,
      username,
      photo_url,
      bpm
    });
  } catch (error) {
    console.error('Error processing initData:', error);
    if (error instanceof SyntaxError) { // JSON parse error
      return res.status(400).json({ error: 'Invalid user JSON' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle updates
app.post('/update_user_prefs', (req: Request, res: Response) => {
  //console.log('Received POST /update_user_prefs');
  const user_id_str = req.body.user_id;
  const bpm_str = req.body.bpm;

  if (!user_id_str || !bpm_str) {
    console.warn('Missing user_id or bpm');
    return res.status(400).json({ error: 'Missing user_id or bpm' });
  }

  try {
    const user_id: number = parseInt(user_id_str, 10);
    const bpm: number = parseInt(bpm_str, 10);

    if (isNaN(user_id) || isNaN(bpm)) {
      throw new Error('Invalid format');
    }

    const updateStmt = db.query('UPDATE telegram_users SET bpm = ? WHERE user_id = ?');
    updateStmt.run(bpm, user_id);
    //console.log(`Updated bpm for user ${user_id} to ${bpm}`);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in update_user_prefs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Telegram Bot setup with Grammy
if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not set in environment variables.');
  process.exit(1);
}
console.log('Initializing bot...');
const bot = new Bot(TELEGRAM_BOT_TOKEN);

bot.command('start', async (ctx) => {
  console.log('Received /start command');
  const user_id = ctx.from?.id;
  if (!user_id) return;

  const selectStmt = db.query('SELECT * FROM telegram_users WHERE user_id = ?');
  const user = selectStmt.get(user_id);

  let welcome_msg: string;
  if (user) {
    welcome_msg = `Welcome back, ${user.first_name}!`;
  } else {
    welcome_msg = 'Welcome! Please use our web app to get started.';
  }

  await ctx.reply(welcome_msg);
});

bot.on('message:text', async (ctx) => {
  console.log('Received text message');
  await ctx.reply('Please use our web interface for full functionality.');
});

bot.on('callback_query', async (ctx) => {
  console.log('Received callback query');
  const data = ctx.callbackQuery.data;
  await ctx.reply(`Action received: ${data}`);
});

// Telegram Bot Webhook
app.post('/whook', (req, res, next) => {
  console.log('Received webhook update');
  webhookCallback(bot, 'express')(req, res, next);
});

async function tgmessage_user(telegram_id: number, message: string): Promise<boolean> {
  try {
    await bot.api.sendMessage(telegram_id, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    console.log(`Message sent to ${telegram_id}`);
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

// Run the app
if (import.meta.main) {
  console.log('Starting application...');

  const isInitialized = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_users';").get();
  if (!isInitialized) {
    console.log('Database not initialized, initializing...');
    init_db();
  } else {
    console.log('Database already initialized, skipping init.');
  }

  app.listen(BOT_LPORT, '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${BOT_LPORT}`);
  });
}

// Close db on process exit
process.on('SIGINT', () => {
  console.log('Closing database...');
  db.close();
  process.exit();
});
