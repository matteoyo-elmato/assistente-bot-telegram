// ─── Parser locale ────────────────────────────────────────────────────────
// Riconosce i pattern più comuni senza chiamare API esterne.
// Restituisce un oggetto intent oppure null se non riconosce nulla.

function parse(text) {
  const t = text.toLowerCase().trim();

  // ── PROMEMORIA ───────────────────────────────────────────────────────────
  const reminderPatterns = [
    /ricordami(?:\s+di)?\s+(.+?)\s+(?:domani|tra|alle|il|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)/i,
    /ricordami\s+(.+)/i,
    /promemoria[:\s]+(.+)/i,
    /reminder[:\s]+(.+)/i,
  ];

  for (const pattern of reminderPatterns) {
    const match = text.match(pattern);
    if (match) {
      const reminderText = extractReminderText(text);
      const remindAt = parseDateTime(text);
      if (reminderText) {
        return { type: 'reminder', text: reminderText, remindAt };
      }
    }
  }

  // ── SPESE ────────────────────────────────────────────────────────────────
  // "ho speso 45€ per la pizza"
  // "spesa: 85 euro supermercato"
  // "45€ benzina"
  const expensePatterns = [
    /(?:ho speso|spesa[:\s]+|pagato|costo)\s+(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)?\s*(?:per|al|alla|nel|di)?\s*(.*)/i,
    /(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)\s+(?:per|di)?\s*(.*)/i,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)\s+(.*)/i,
  ];

  for (const pattern of expensePatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'));
      const description = (match[2] || '').trim() || 'Spesa generica';
      if (amount > 0 && amount < 100000) {
        return {
          type: 'expense',
          amount,
          description,
          category: guessCategory(description),
        };
      }
    }
  }

  // ── QUERY SPESE ──────────────────────────────────────────────────────────
  if (/quanto\s+ho\s+speso|totale\s+spese|riepilogo\s+spese|spese\s+del\s+mese/i.test(t)) {
    return { type: 'expense_query' };
  }

  // ── LISTA — aggiungi ─────────────────────────────────────────────────────
  const listAddPatterns = [
    /aggiungi\s+(.+?)\s+alla\s+lista\s+(\w+)/i,
    /aggiungi\s+(.+?)\s+(?:alla\s+)?lista/i,
    /metti\s+(.+?)\s+(?:nella\s+|in\s+)?lista\s*(\w*)/i,
    /inserisci\s+(.+?)\s+(?:nella\s+|in\s+)?lista\s*(\w*)/i,
  ];

  for (const pattern of listAddPatterns) {
    const match = text.match(pattern);
    if (match) {
      const itemsRaw = match[1];
      const listName = (match[2] || 'spesa').toLowerCase().trim();
      const items = splitItems(itemsRaw);
      if (items.length > 0) {
        return { type: 'list_add', listName, items };
      }
    }
  }

  // ── LISTA — mostra ───────────────────────────────────────────────────────
  const listShowPatterns = [
    /(?:mostrami|dimmi|vedi|visualizza|cosa c'è|cosa ci sta)\s+(?:nella\s+|in\s+)?lista\s*(\w*)/i,
    /lista\s+(\w+)/i,
    /^lista$/i,
  ];

  for (const pattern of listShowPatterns) {
    const match = t.match(pattern);
    if (match) {
      const listName = (match[1] || 'spesa').toLowerCase().trim() || 'spesa';
      return { type: 'list_show', listName };
    }
  }

  // ── LISTA — rimuovi ──────────────────────────────────────────────────────
  const listRemovePatterns = [
    /(?:rimuovi|togli|elimina|cancella)\s+(.+?)\s+dalla\s+lista\s*(\w*)/i,
    /(?:rimuovi|togli)\s+(.+?)\s+(?:dalla\s+)?lista/i,
  ];

  for (const pattern of listRemovePatterns) {
    const match = text.match(pattern);
    if (match) {
      const items = splitItems(match[1]);
      const listName = (match[2] || 'spesa').toLowerCase().trim();
      if (items.length > 0) {
        return { type: 'list_remove', listName, items };
      }
    }
  }

  // ── NOTE ─────────────────────────────────────────────────────────────────
  const notePatterns = [
    /^nota[:\s]+(.+)/i,
    /^appunto[:\s]+(.+)/i,
    /^salva[:\s]+(.+)/i,
    /^ricorda(?:ti)?[:\s]+(?!di\s)(.+)/i,
  ];

  for (const pattern of notePatterns) {
    const match = text.match(pattern);
    if (match) {
      return { type: 'note', text: match[1].trim() };
    }
  }

  // ── NOTE — mostra ────────────────────────────────────────────────────────
  if (/(?:mostrami|dimmi|vedi|visualizza)\s+(?:le\s+)?(?:mie\s+)?note/i.test(t) || /^note$/i.test(t)) {
    return { type: 'notes_show' };
  }

  return null; // non riconosciuto → Gemini
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractReminderText(text) {
  // Rimuove la parte "ricordami di" e la parte temporale
  let t = text
    .replace(/ricordami\s+di\s+/i, '')
    .replace(/ricordami\s+/i, '')
    .replace(/promemoria[:\s]+/i, '');

  // Rimuove indicatori temporali dalla fine
  t = t
    .replace(/\s+domani(\s+(?:mattina|pomeriggio|sera))?\s*(alle\s+\d{1,2}(?:[:.,]\d{2})?)?$/i, '')
    .replace(/\s+oggi(\s+(?:mattina|pomeriggio|sera))?\s*(alle\s+\d{1,2}(?:[:.,]\d{2})?)?$/i, '')
    .replace(/\s+alle\s+\d{1,2}(?:[:.,]\d{2})?$/i, '')
    .replace(/\s+tra\s+\d+\s+(?:minuti?|ore?|giorni?)$/i, '')
    .replace(/\s+il\s+\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?(\s+alle\s+\d{1,2}(?:[:.,]\d{2})?)?$/i, '')
    .trim();

  return t || null;
}

function parseDateTime(text) {
  const now = new Date();
  const t = text.toLowerCase();

  // "tra X minuti/ore/giorni"
  const traMatch = t.match(/tra\s+(\d+)\s+(minut[io]|or[ae]|giorn[io])/i);
  if (traMatch) {
    const n = parseInt(traMatch[1]);
    const unit = traMatch[2].toLowerCase();
    const ms = unit.startsWith('minut') ? n * 60000
              : unit.startsWith('or') ? n * 3600000
              : n * 86400000;
    return Date.now() + ms;
  }

  // Estrai ora "alle HH:MM" o "alle HH"
  const timeMatch = t.match(/alle\s+(\d{1,2})(?:[:.,''](\d{2}))?/);
  let hour = timeMatch ? parseInt(timeMatch[1]) : null;
  let minute = timeMatch && timeMatch[2] ? parseInt(timeMatch[2]) : 0;

  // Giorno base
  let base = new Date(now);

  if (/domani/i.test(t)) {
    base.setDate(base.getDate() + 1);
  } else if (/dopodomani/i.test(t)) {
    base.setDate(base.getDate() + 2);
  } else {
    // Giorno della settimana
    const days = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
    for (let i = 0; i < days.length; i++) {
      if (t.includes(days[i])) {
        let diff = i - now.getDay();
        if (diff <= 0) diff += 7;
        base.setDate(base.getDate() + diff);
        break;
      }
    }
  }

  // Imposta ora
  if (hour !== null) {
    base.setHours(hour, minute, 0, 0);
  } else {
    // Orario di default per mattina/pomeriggio/sera
    if (/mattina/i.test(t)) base.setHours(9, 0, 0, 0);
    else if (/pomeriggio/i.test(t)) base.setHours(15, 0, 0, 0);
    else if (/sera/i.test(t)) base.setHours(20, 0, 0, 0);
    else base.setHours(9, 0, 0, 0); // default 9:00
  }

  // Se è già passata oggi, sposta a domani
  if (base.getTime() <= Date.now() && !/domani|dopodomani|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica/i.test(t)) {
    base.setDate(base.getDate() + 1);
  }

  return base.getTime();
}

function guessCategory(description) {
  const d = description.toLowerCase();
  if (/supermercato|spesa|alimentari|cibo|pizza|ristorante|bar|caffè|pranzo|cena|colazione|mangiare/i.test(d)) return 'Cibo';
  if (/benzina|gasolio|carburante|autostrada|treno|bus|metro|taxi|parcheggio/i.test(d)) return 'Trasporti';
  if (/farmaci?|medico|dottore|visita|dentista|ospedale/i.test(d)) return 'Salute';
  if (/affitto|mutuo|luce|gas|acqua|internet|telefono|bolletta/i.test(d)) return 'Casa';
  if (/abbigliamento|scarpe|vestiti|shopping|amazon|zalando/i.test(d)) return 'Shopping';
  if (/palestra|sport|cinema|teatro|libro|spotify|netflix/i.test(d)) return 'Svago';
  return 'Altro';
}

function splitItems(raw) {
  return raw
    .split(/[,;e]\s+|,/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

module.exports = { parse };
