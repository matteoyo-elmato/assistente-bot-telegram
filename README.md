# 🤖 Assistente Bot Telegram

Bot personale su Telegram con promemoria, registro spese, liste e note.
Usa logica locale per i casi comuni e Google Gemini (gratuito) come fallback AI.

---

## 📋 Requisiti

- Account GitHub
- Account Railway.app (gratuito)
- Bot Telegram creato con @BotFather
- API Key Google Gemini (gratuita da aistudio.google.com)

---

## 🚀 Deploy su Railway (passo per passo)

### 1. Prepara il repository GitHub

1. Vai su github.com → New repository
2. Nome: `assistente-bot-telegram`
3. Privato ✓ (importante!)
4. Crea il repo

Poi carica tutti i file di questo progetto nel repo (tranne `.env` e `node_modules`).

### 2. Crea il progetto su Railway

1. Vai su railway.app → Login con GitHub
2. Click **New Project**
3. Scegli **Deploy from GitHub repo**
4. Seleziona `assistente-bot-telegram`
5. Railway rileva automaticamente Node.js e fa il primo deploy

### 3. Aggiungi le variabili d'ambiente

In Railway, vai su:
**Il tuo progetto** → **Variables** → **Add Variable**

Aggiungi:
```
TELEGRAM_TOKEN = (il token che ti ha dato BotFather)
GEMINI_API_KEY = (la key da aistudio.google.com)
```

### 4. Aggiungi un volume persistente per il database

In Railway:
1. Vai su **Add Service** → **Volume**
2. Mount Path: `/app`
3. Questo salva il file `data.db` anche dopo i restart

> Senza il volume, i dati si resettano ad ogni deploy. Con il piano gratuito Railway,
> considera di usare un database esterno (vedi sezione avanzata).

### 5. Controlla i log

In Railway → il tuo servizio → **Logs**
Dovresti vedere:
```
🤖 Bot avviato!
⏰ Scheduler promemoria avviato
```

Vai su Telegram, scrivi al tuo bot `/start` — se risponde, tutto funziona! 🎉

---

## 💬 Come usare il bot

### Promemoria
```
Ricordami di chiamare Mario domani alle 15
Ricordami la riunione venerdì alle 9:30
Tra 30 minuti ricordami di controllare il forno
```

### Spese
```
Ho speso 45€ al supermercato
Spesa: 20 euro benzina
Pagato 12€ per il caffè
Quanto ho speso questo mese?
```

### Lista della spesa
```
Aggiungi latte, pane e uova alla lista spesa
Aggiungi vino alla lista
Mostrami la lista spesa
Rimuovi latte dalla lista spesa
```

### Note
```
Nota: numero del dentista 06 1234567
Nota: password wifi ospiti: casa2024
Mostrami le mie note
```

### Comandi rapidi
- `/start` — messaggio di benvenuto
- `/help` — guida completa
- `/promemoria` — tutti i promemoria attivi
- `/spese` — riepilogo spese del mese per categoria
- `/lista` — lista della spesa
- `/note` — tutte le note salvate

---

## 🔧 Struttura del progetto

```
assistente-bot-telegram/
├── index.js        # Bot principale + gestione messaggi
├── parser.js       # Logica locale (riconosce intenti senza AI)
├── database.js     # Database SQLite (promemoria, spese, liste, note)
├── scheduler.js    # Invia promemoria all'orario giusto
├── package.json    # Dipendenze
├── .env.example    # Template variabili d'ambiente
└── .gitignore      # Esclude .env e node_modules da Git
```

---

## 💰 Costi

| Servizio | Piano | Costo |
|----------|-------|-------|
| Telegram Bot API | Sempre gratuito | €0 |
| Google Gemini API | Gratuito (1.500 req/giorno) | €0 |
| Railway.app | 500h/mese gratis | €0 |
| **Totale MVP** | | **€0** |

---

## 📈 Prossimi step

- [ ] Aggiungere WhatsApp Business API
- [ ] Sistema di abbonamenti con Stripe
- [ ] Dashboard web per visualizzare spese
- [ ] Export PDF report mensile
- [ ] Bot di gruppo per team
