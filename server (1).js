const express = require('express');
const app = express();
app.use(express.json());
app.use(express.static('public'));

const schedules = {};

async function sendTelegram(chatId, botToken, message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
  });
  return res.json();
}

// Mulai timer
app.post('/api/start', (req, res) => {
  const { index, name, chatId, botToken } = req.body;
  if (!chatId || !botToken) return res.status(400).json({ error: 'Missing config' });

  if (schedules[index]) clearTimeout(schedules[index]);

  const endTs = Date.now() + 5 * 60 * 60 * 1000;
  const delay = endTs - Date.now();

  schedules[index] = setTimeout(async () => {
    await sendTelegram(chatId, botToken,
      `✅ <b>${name}</b> Gemini sudah reset!\n\nAkun siap dipakai lagi sekarang.`
    );
    delete schedules[index];
  }, delay);

  const jam = new Date(endTs).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  });

  sendTelegram(chatId, botToken,
    `⏱ Timer <b>${name}</b> dimulai\nReset jam <b>${jam} WIB</b>`
  );

  res.json({ ok: true, endTs });
});

// Stop timer
app.post('/api/stop', (req, res) => {
  const { index } = req.body;
  if (schedules[index]) { clearTimeout(schedules[index]); delete schedules[index]; }
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
