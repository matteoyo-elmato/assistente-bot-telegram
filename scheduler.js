// Controlla ogni minuto se ci sono promemoria da inviare

function start(bot, db) {
  console.log('⏰ Scheduler promemoria avviato');

  setInterval(() => {
    try {
      const pending = db.getPendingReminders();
      for (const reminder of pending) {
        bot.sendMessage(
          reminder.chat_id,
          `⏰ *PROMEMORIA*\n\n${reminder.text}`,
          { parse_mode: 'Markdown' }
        ).then(() => {
          db.markReminderSent(reminder.id);
          console.log(`✅ Promemoria inviato a user ${reminder.user_id}: ${reminder.text}`);
        }).catch(err => {
          console.error(`❌ Errore invio promemoria ${reminder.id}:`, err.message);
        });
      }
    } catch (err) {
      console.error('Errore scheduler:', err.message);
    }
  }, 60 * 1000); // ogni 60 secondi
}

module.exports = { start };
