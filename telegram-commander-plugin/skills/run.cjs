const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Find project root (assumes process.cwd() is the project root)
const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env.local');

// Load environment variables
try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
} catch (e) {
  console.error("Failed to load .env.local", e.message);
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const threadId = process.env.TELEGRAM_THREAD_ID;
const command = process.argv.slice(2).join(' ');

if (!token || !chatId) {
  console.error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env.local");
  process.exit(1);
}

if (!command) {
  console.error("No command provided. Usage: node run.cjs \"<command>\"");
  process.exit(1);
}

const reqId = Date.now().toString() + Math.floor(Math.random() * 1000);

// Telegram API Helper
function api(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(chunks));
        } catch {
          reject(new Error("Failed to parse Telegram response"));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function start() {
  console.log(`[Telegram Commander] Requesting permission to run: \`${command}\``);
  
  // Send message
  const msgRes = await api('sendMessage', {
    chat_id: chatId,
    message_thread_id: threadId,
    text: `⚠️ *Command Approval Request*\n\n\`${command}\``,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Allow", callback_data: `allow_${reqId}` },
        { text: "❌ Decline", callback_data: `decline_${reqId}` }
      ]]
    }
  });

  if (!msgRes.ok) {
    console.error("Failed to send approval request to Telegram:", msgRes);
    process.exit(1);
  }

  const messageId = msgRes.result.message_id;
  console.log(`[Telegram Commander] Waiting for your approval on Telegram...`);

  // Poll
  let lastUpdateId = 0;
  while (true) {
    const updatesRes = await api('getUpdates', { 
      offset: lastUpdateId + 1, 
      timeout: 30, // Long polling
      allowed_updates: ['callback_query']
    });

    if (updatesRes.ok && updatesRes.result.length > 0) {
      for (const update of updatesRes.result) {
        lastUpdateId = update.update_id;
        
        if (update.callback_query && update.callback_query.data.endsWith(`_${reqId}`)) {
          const action = update.callback_query.data.split('_')[0];
          
          // Answer callback query to remove loading state
          await api('answerCallbackQuery', { 
            callback_query_id: update.callback_query.id,
            text: action === 'allow' ? "Command Executing..." : "Command Aborted."
          });
          
          if (action === 'allow') {
            await api('editMessageText', {
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *Command Approved*\n\n\`${command}\``,
              parse_mode: 'Markdown'
            });
            
            console.log("\n✅ Command approved. Executing now...\n" + "=".repeat(50) + "\n");
            executeCommand();
            return;
            
          } else {
            await api('editMessageText', {
              chat_id: chatId,
              message_id: messageId,
              text: `❌ *Command Declined*\n\n\`${command}\``,
              parse_mode: 'Markdown'
            });
            
            console.error("\n❌ Command declined by user.");
            process.exit(1);
          }
        }
      }
    }
    
    // Short delay to avoid spamming if long-polling drops
    await new Promise(r => setTimeout(r, 1000));
  }
}

function executeCommand() {
  const child = spawn(command, { 
    shell: true, 
    stdio: 'inherit',
    cwd: rootDir
  });
  
  child.on('close', code => {
    console.log(`\n${"=".repeat(50)}\nProcess exited with code ${code}`);
    process.exit(code);
  });
  
  child.on('error', err => {
    console.error("Failed to spawn command:", err);
    process.exit(1);
  });
}

start().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
