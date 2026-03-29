require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const db = require('./database');
const parser = require('./parser');
const scheduler = require('./scheduler');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

console.log('🤖 Bot avviato!');

// ── Limiti per piano ──────────────────────────────────────────────────────
const PLAN_LIMITS = {
  free:     { dailyMessages: 20,   label: 'Free',     price: 'Gratis' },
  personal: { dailyMessages: 99999, label: 'Personal', price: '€3,99/mese' },
  pro:      { dailyMessages: 99999, label: 'Pro',      price: '€7,99/mese' },
  business: { dailyMessages: 99999, label: 'Business', price: '€19,99/mese' },
};

function isAllowed(userId) {
  const user = db.getUser(userId);
  const plan = user?.plan || 'free';
  if (plan !== 'free') return true;
  const today = new Date().toISOString().split('T')[0];
  const count = db.getDailyMessageCount(userId, today);
  return count < PLAN_LIMITS.free.dailyMessages;
}

// ── /start ────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;
  const name = msg.from.first_name || 'amico';
  db.upsertUser(userId, msg.from.username || '', name);

  bot.sendMessage(msg.chat.id,
    `👋 Ciao ${name}! Sono il tuo assistente personale.\n\n` +
    `Ecco cosa posso fare:\n` +
    `⏰ *Promemoria* — "Ricordami di chiamare Mario domani alle 15"\n` +
    `💰 *Spese* — "Ho speso 45€ al supermercato"\n` +
    `📋 *Liste* — "Aggiungi latte e pane alla lista spesa"\n` +
    `📝 *Note* — "Nota: numero medico 06 12345678"\n\n` +
    `Piano attuale: *Free* (20 messaggi/giorno)\n` +
    `Usa /piano per i piani disponibili 🚀`,
    { parse_mode: 'Markdown' }
  );
});

// ── /help ─────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 *Guida rapida*\n\n` +
    `*Promemoria:*\n` +
    `• "Ricordami X alle 15:00"\n` +
    `• "Domani mattina ricordami di X"\n` +
    `• "Tra 30 minuti ricordami X"\n\n` +
    `*Spese:*\n` +
    `• "Ho speso 20€ per la pizza"\n` +
    `• "Spesa: 85€ supermercato"\n` +
    `• "Quanto ho speso questo mese?"\n\n` +
    `*Liste:*\n` +
    `• "Aggiungi X alla lista spesa"\n` +
    `• "Mostrami la lista spesa"\n` +
    `• "Rimuovi X dalla lista"\n\n` +
    `*Note:*\n` +
    `• "Nota: testo da salvare"\n` +
    `• "Mostrami le mie note"\n\n` +
    `*Comandi:*\n` +
    `/promemoria — promemoria attivi\n` +
    `/spese — riepilogo mensile\n` +
    `/lista — lista della spesa\n` +
    `/note — tutte le note\n` +
    `/piano — piani e abbonamenti`,
    { parse_mode: 'Markdown' }
  );
});

// ── /piano ────────────────────────────────────────────────────────────────
bot.onText(/\/piano/, (msg) => {
  const user = db.getUser(msg.from.id);
  const currentPlan = user?.plan || 'free';
  const current = PLAN_LIMITS[currentPlan];

  let text = `📊 *Il tuo piano: ${current.label}*\n\n`;
  text += `*Piani disponibili:*\n\n`;
  text += `🆓 *Free* — Gratis\n   20 messaggi/giorno\n\n`;
  text += `👤 *Personal* — €3,99/mese\n   Messaggi illimitati, tutte le funzioni\n\n`;
  text += `⚡ *Pro* — €7,99/mese\n   Personal + report mensili e export dati\n\n`;
  text += `🏢 *Business* — €19,99/mese\n   Pro + multi-utente e supporto prioritario\n\n`;
  text += `💳 Per attivare un piano scrivimi o visita il sito.`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// ── /promemoria ───────────────────────────────────────────────────────────
bot.onText(/\/promemoria/, (msg) => {
  const reminders = db.getReminders(msg.from.id);
  if (reminders.length === 0) {
    bot.sendMessage(msg.chat.id, '📭 Nessun promemoria attivo.');
    return;
  }
  const list = reminders.map((r, i) => {
    const date = new Date(r.remind_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
    return `${i + 1}. ⏰ *${r.text}*\n   📅 ${date}`;
  }).join('\n\n');
  bot.sendMessage(msg.chat.id, `📋 *Promemoria attivi:*\n\n${list}`, { parse_mode: 'Markdown' });
});

// ── /spese ────────────────────────────────────────────────────────────────
bot.onText(/\/spese/, (msg) => {
  const now = new Date();
  const spese = db.getExpenses(msg.from.id, now.getMonth() + 1, now.getFullYear());
  if (spese.length === 0) {
    bot.sendMessage(msg.chat.id, '📭 Nessuna spesa registrata questo mese.');
    return;
  }
  const total = spese.reduce((sum, s) => sum + s.amount, 0);
  const byCategory = {};
  spese.forEach(s => { byCategory[s.category] = (byCategory[s.category] || 0) + s.amount; });
  const catLines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  • ${cat}: *€${amt.toFixed(2)}*`)
    .join('\n');
  const mese = now.toLocaleString('it-IT', { month: 'long' });
  bot.sendMessage(msg.chat.id,
    `💰 *Spese di ${mese}:*\n\n${catLines}\n\n━━━━━━━━\n*Totale: €${total.toFixed(2)}*`,
    { parse_mode: 'Markdown' }
  );
});

// ── /lista ────────────────────────────────────────────────────────────────
bot.onText(/\/lista/, (msg) => showList(msg.chat.id, msg.from.id, 'spesa'));

// ── /note ─────────────────────────────────────────────────────────────────
bot.onText(/\/note/, (msg) => {
  const notes = db.getNotes(msg.from.id);
  if (notes.length === 0) {
    bot.sendMessage(msg.chat.id, '📭 Nessuna nota salvata.');
    return;
  }
  const list = notes.map((n, i) => {
    const date = new Date(n.created_at).toLocaleDateString('it-IT');
    return `${i + 1}. 📝 ${n.text}\n   _${date}_`;
  }).join('\n\n');
  bot.sendMessage(msg.chat.id, `📒 *Le tue note:*\n\n${list}`, { parse_mode: 'Markdown' });
});

// ── Messaggio generico ────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Registra utente
  db.upsertUser(userId, msg.from.username || '', msg.from.first_name || '');

  // Controlla limiti
  if (!isAllowed(userId)) {
    bot.sendMessage(chatId,
      `⚠️ Hai raggiunto il limite di *20 messaggi/giorno* del piano Free.\n\n` +
      `Passa a *Personal* per messaggi illimitati!\nUsa /piano per i dettagli 🚀`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Traccia utilizzo
  const today = new Date().toISOString().split('T')[0];
  db.incrementDailyCount(userId, today);

  // 1. Parser locale (veloce, zero API)
  const parsed = parser.parse(text);
  if (parsed) {
    await handleIntent(chatId, userId, parsed);
    return;
  }

  // 2. Groq fallback (14.400 req/giorno gratis)
  try {
    const groqResult = await askGroq(text);
    if (groqResult) {
      await handleIntent(chatId, userId, groqResult);
      return;
    }
  } catch (e) {
    console.error('Errore Groq:', e.message);
  }

  // 3. Non capito
  bot.sendMessage(chatId,
    `🤔 Non ho capito bene. Prova così:\n\n` +
    `• "Ricordami X alle 15:00"\n` +
    `• "Ho speso 20€ per Y"\n` +
    `• "Aggiungi X alla lista"\n` +
    `• "Nota: testo"\n\n` +
    `/help per la guida completa.`
  );
});

// ── Gestione intent ───────────────────────────────────────────────────────
async function handleIntent(chatId, userId, intent) {
  switch (intent.type) {
    case 'reminder': {
      if (!intent.remindAt || intent.remindAt <= Date.now()) {
        bot.sendMessage(chatId, '⚠️ Non ho capito quando. Prova: "domani alle 15:00" o "tra 2 ore"');
        return;
      }
      db.addReminder(userId, chatId, intent.text, intent.remindAt);
      const dateStr = new Date(intent.remindAt).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' });
      bot.sendMessage(chatId,
        `⏰ *Promemoria impostato!*\n\n📌 ${intent.text}\n📅 ${dateStr}`,
        { parse_mode: 'Markdown' }
      );
      break;
    }
    case 'expense': {
      db.addExpense(userId, intent.amount, intent.category, intent.description);
      bot.sendMessage(chatId,
        `✅ *Spesa registrata!*\n\n💰 €${intent.amount.toFixed(2)}\n📂 ${intent.category}\n📝 ${intent.description}`,
        { parse_mode: 'Markdown' }
      );
      break;
    }
    case 'expense_query': {
      const now = new Date();
      const spese = db.getExpenses(userId, now.getMonth() + 1, now.getFullYear());
      const total = spese.reduce((sum, s) => sum + s.amount, 0);
      bot.sendMessage(chatId,
        `💰 Questo mese hai speso: *€${total.toFixed(2)}*\n\n/spese per il dettaglio per categoria.`,
        { parse_mode: 'Markdown' }
      );
      break;
    }
    case 'list_add': {
      db.addToList(userId, intent.listName, intent.items);
      bot.sendMessage(chatId,
        `📋 Aggiunto alla lista *${intent.listName}*:\n• ${intent.items.join('\n• ')}`,
        { parse_mode: 'Markdown' }
      );
      break;
    }
    case 'list_show': {
      showList(chatId, userId, intent.listName);
      break;
    }
    case 'list_remove': {
      db.removeFromList(userId, intent.listName, intent.items);
      bot.sendMessage(chatId,
        `✅ Rimosso dalla lista *${intent.listName}*:\n• ${intent.items.join('\n• ')}`,
        { parse_mode: 'Markdown' }
      );
      break;
    }
    case 'note': {
      db.addNote(userId, intent.text);
      bot.sendMessage(chatId, `📝 *Nota salvata!*\n\n_${intent.text}_`, { parse_mode: 'Markdown' });
      break;
    }
    case 'notes_show': {
      const notes = db.getNotes(userId);
      if (notes.length === 0) { bot.sendMessage(chatId, '📭 Nessuna nota salvata.'); return; }
      const list = notes.slice(0, 10).map((n, i) => `${i + 1}. ${n.text}`).join('\n');
      bot.sendMessage(chatId, `📒 *Le tue note:*\n\n${list}`, { parse_mode: 'Markdown' });
      break;
    }
  }
}

// ── Helper lista ──────────────────────────────────────────────────────────
function showList(chatId, userId, listName) {
  const items = db.getList(userId, listName);
  if (items.length === 0) {
    bot.sendMessage(chatId, `📭 La lista *${listName}* è vuota.`, { parse_mode: 'Markdown' });
    return;
  }
  const list = items.map(i => `• ${i.item}`).join('\n');
  bot.sendMessage(chatId, `📋 *Lista ${listName}:*\n\n${list}`, { parse_mode: 'Markdown' });
}

// ── Groq AI fallback ──────────────────────────────────────────────────────
async function askGroq(text) {
  const completion = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    max_tokens: 300,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `Sei un parser di messaggi per un assistente personale italiano. 
Rispondi SOLO con JSON valido, zero testo extra.

Intent disponibili:
- "reminder": campi text (string), remindAt (timestamp ms Unix)
- "expense": campi amount (number), category ("Cibo"|"Trasporti"|"Salute"|"Casa"|"Shopping"|"Svago"|"Altro"), description (string)
- "expense_query": nessun campo extra
- "list_add": campi listName (string), items (string[])
- "list_show": campo listName (string)
- "list_remove": campi listName (string), items (string[])
- "note": campo text (string)
- "notes_show": nessun campo extra

Se non corrisponde a nulla: {"type": null}
Data ora attuale: ${new Date().toISOString()}`
      },
      { role: 'user', content: text }
    ]
  });

  const raw = completion.choices[0]?.message?.content?.trim() || '';
  try {
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return result?.type ? result : null;
  } catch {
    console.error('Groq parse error:', raw);
    return null;
  }
}

// ── Scheduler promemoria ──────────────────────────────────────────────────
scheduler.start(bot, db);
