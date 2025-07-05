// index.js – Professional Temp-Mail Bot (CommonJS)
// Built by X NiL 

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const chalk = require('chalk'); // v4 – compatible with require()
const dayjs = require('dayjs');

const BOT_TOKEN = 'your_bot_token';
if (!BOT_TOKEN) throw new Error('🚨 BOT_TOKEN is missing!');

const bot   = new TelegramBot(BOT_TOKEN, { polling: true });
const users = new Map();

const esc = (s = '') =>
  s.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;');

const createTempMail = async () => {
  const { data } = await axios.get('https://xnil.xnil.work.gd/xnil/tmgen');
  return data?.data;
};

const fetchInbox = async (email) => {
  const { data } = await axios.get('https://xnil.xnil.work.gd/xnil/tminbox', {
    params: { mail: email }
  });
  if (!data || !data.data) return [];
  return Array.isArray(data.data) ? data.data : [data.data];
};

// /start command: Show instructions & generate email
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const mail = await createTempMail();
    users.set(chatId, { ...mail, lastId: null });

    const welcome = `
👋 <b>Welcome to TempMail Bot</b>
🧪 Generate anonymous email addresses in seconds.

📧 <b>Your Temp-Mail:</b>
<code>${esc(mail.email)}</code>

💡 <i>Use this email on any site or app. Then come back and press:</i>
📥 <b>Check Inbox</b> (wait 30 seconds for mail to arrive)

🔁 Want a new address? Use the ♻️ <b>New Email</b> button.
    `.trim();

    await bot.sendMessage(chatId, welcome, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '📥 Check Inbox', callback_data: 'CHECK' },
          { text: '♻️ New Email',  callback_data: 'RESET' }
        ]]
      }
    });
  } catch (e) {
    console.error(chalk.red('Mail generation failed:'), e.message);
    bot.sendMessage(chatId, '❌ Could not generate email. Try again later.');
  }
});

// Callback buttons: Check or Reset
bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  let user = users.get(chatId);

  const respond = (text = '', alert = false) =>
    bot.answerCallbackQuery(q.id, { text, show_alert: alert });

  if (q.data === 'RESET') {
    try {
      const mail = await createTempMail();
      users.set(chatId, { ...mail, lastId: null });
      await respond('✅ New email address created!');

      const text = `
📧 <b>Your New Temp-Mail:</b>
<code>${esc(mail.email)}</code>

You can use this anywhere.
Then come back and click below to check inbox 👇
      `.trim();

      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: q.message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '📥 Check Inbox', callback_data: 'CHECK' },
            { text: '♻️ New Email',  callback_data: 'RESET' }
          ]]
        }
      });
    } catch (e) {
      console.error(chalk.red('RESET error:'), e.message);
      await respond('❌ Failed to reset email.');
    }
    return;
  }

  if (q.data === 'CHECK') {
    if (!user) return respond('❌ Please run /start first.', true);
    await respond();

    const checkingMsg = await bot.sendMessage(chatId, '⏳ Checking inbox…');

    // Animate "checking" message for 30 seconds
    const dots = ['⏳', '⏳.', '⏳..', '⏳...'];
    let i = 0;
    const anim = setInterval(() => {
      bot.editMessageText(dots[i++ % dots.length], {
        chat_id: chatId,
        message_id: checkingMsg.message_id
      });
    }, 750);

    await new Promise(r => setTimeout(r, 30000));
    clearInterval(anim);

    try {
      const mails = await fetchInbox(user.email);
      const newMails = mails.filter(m => m.id !== user.lastId);
      if (!newMails.length) {
        await bot.editMessageText('📭 No new emails found. Try again later!', {
          chat_id: chatId,
          message_id: checkingMsg.message_id
        });
        return;
      }

      const mail = newMails[newMails.length - 1]; // latest mail
      users.set(chatId, { ...user, lastId: mail.id });

      const mailText = `
✉️ <b>New Email</b>
👤 <b>From:</b> <code>${esc(mail.from)}</code>
📌 <b>Subject:</b> <code>${esc(mail.subject)}</code>
🕒 <b>Time:</b> ${dayjs(mail.created_at).format('D MMM YYYY, h:mm A')}

📝 <b>Message:</b>
<pre>${esc(mail.body_text || '(empty)')}</pre>
      `.trim();

      await bot.editMessageText(mailText, {
        chat_id: chatId,
        message_id: checkingMsg.message_id,
        parse_mode: 'HTML'
      });
    } catch (e) {
      console.error(chalk.red('Inbox error:'), e.message);
      bot.editMessageText('⚠️ Error checking inbox. Try again later.', {
        chat_id: chatId,
        message_id: checkingMsg.message_id
      });
    }
  }
});

console.log(chalk.green('✅ Temp-Mail Bot is running!'));
