const express = require('express');
const app = express();
app.use(express.json());

let accounts = [
  'Akun 1', 'Akun 2', 'Akun 3',
  'Akun 4', 'Akun 5', 'Akun 6'
];
const timers = {};
const endTimes = {};

const DURATION = 5 * 60 * 60 * 1000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

async function sendMsg(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
  });
}

function jamWIB(ts) {
  return new Date(ts).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  });
}

function formatSisa(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function startTimer(index) {
  if (timers[index]) clearTimeout(timers[index]);
  const endTs = Date.now() + DURATION;
  endTimes[index] = endTs;
  timers[index] = setTimeout(async () => {
    delete timers[index];
    delete endTimes[index];
    const name = accounts[index] || `Akun ${index + 1}`;
    await sendMsg(`✅ <b>${name}</b> sudah reset!\n\nAkun Gemini siap dipakai lagi sekarang.`);
  }, DURATION);
  return endTs;
}

function stopTimer(index) {
  if (timers[index]) {
    clearTimeout(timers[index]);
    delete timers[index];
    delete endTimes[index];
    return true;
  }
  return false;
}

function buildStatusMsg() {
  if (accounts.length === 0) return '📭 Belum ada akun. Gunakan /addakun NamaAkun';
  let msg = '⏱ <b>Gemini Reset Timer</b>\n\n';
  accounts.forEach((name, i) => {
    const running = !!timers[i];
    const sisa = endTimes[i] ? endTimes[i] - Date.now() : 0;
    if (running && sisa > 0) {
      msg += `🟠 <b>${i+1}. ${name}</b>\n`;
      msg += `   ⏳ Sisa: ${formatSisa(sisa)} (reset jam ${jamWIB(endTimes[i])} WIB)\n`;
      msg += `   /stop${i+1} untuk batalkan\n\n`;
    } else {
      msg += `🟢 <b>${i+1}. ${name}</b> — Siap\n`;
      msg += `   /limit${i+1} jika kena limit\n\n`;
    }
  });
  msg += '\n<i>Perintah lain:</i>\n';
  msg += '/daftar — lihat semua akun\n';
  msg += '/addakun NamaAkun — tambah akun\n';
  msg += '/hapusakun [nomor] — hapus akun\n';
  msg += '/gantinama [nomor] [nama baru] — ganti nama';
  return msg;
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body?.message;
  if (!msg || !msg.text) return;
  if (String(msg.chat.id) !== String(CHAT_ID)) return;

  const text = msg.text.trim();
  const lower = text.toLowerCase();

  if (lower === '/start' || lower === '/daftar') {
    await sendMsg(buildStatusMsg());
    return;
  }

  const limitMatch = lower.match(/^\/limit(\d+)$/);
  if (limitMatch) {
    const i = parseInt(limitMatch[1]) - 1;
    if (i < 0 || i >= accounts.length) {
      await sendMsg(`⚠️ Akun nomor ${i+1} tidak ada.`);
      return;
    }
    const endTs = startTimer(i);
    await sendMsg(`⏱ Timer <b>${accounts[i]}</b> dimulai!\nReset jam <b>${jamWIB(endTs)} WIB</b>\n\nSaya akan kabari saat sudah reset. ✅`);
    return;
  }

  const stopMatch = lower.match(/^\/stop(\d+)$/);
  if (stopMatch) {
    const i = parseInt(stopMatch[1]) - 1;
    if (i < 0 || i >= accounts.length) {
      await sendMsg(`⚠️ Akun nomor ${i+1} tidak ada.`);
      return;
    }
    const stopped = stopTimer(i);
    if (stopped) {
      await sendMsg(`🛑 Timer <b>${accounts[i]}</b> dibatalkan.`);
    } else {
      await sendMsg(`ℹ️ <b>${accounts[i]}</b> tidak sedang berjalan.`);
    }
    return;
  }

  const addMatch = text.match(/^\/addakun\s+(.+)$/i);
  if (addMatch) {
    if (accounts.length >= 10) {
      await sendMsg('⚠️ Maksimal 10 akun. Hapus dulu dengan /hapusakun [nomor]');
      return;
    }
    const nama = addMatch[1].trim();
    accounts.push(nama);
    await sendMsg(`✅ <b>${nama}</b> ditambahkan sebagai Akun ${accounts.length}.\n\nGunakan /limit${accounts.length} saat kena limit.`);
    return;
  }

  const hapusMatch = text.match(/^\/hapusakun\s+(\d+)$/i);
  if (hapusMatch) {
    const i = parseInt(hapusMatch[1]) - 1;
    if (i < 0 || i >= accounts.length) {
      await sendMsg(`⚠️ Akun nomor ${i+1} tidak ada.`);
      return;
    }
    stopTimer(i);
    const nama = accounts[i];
    accounts.splice(i, 1);
    const newT = {}, newE = {};
    Object.keys(timers).forEach(k => {
      const ki = parseInt(k);
      if (ki > i) { newT[ki-1] = timers[k]; newE[ki-1] = endTimes[k]; }
      else if (ki < i) { newT[ki] = timers[k]; newE[ki] = endTimes[k]; }
    });
    Object.keys(timers).forEach(k => delete timers[k]);
    Object.keys(endTimes).forEach(k => delete endTimes[k]);
    Object.assign(timers, newT);
    Object.assign(endTimes, newE);
    await sendMsg(`🗑️ Akun <b>${nama}</b> dihapus.\n\n${buildStatusMsg()}`);
    return;
  }

  const gantiMatch = text.match(/^\/gantinama\s+(\d+)\s+(.+)$/i);
  if (gantiMatch) {
    const i = parseInt(gantiMatch[1]) - 1;
    if (i < 0 || i >= accounts.length) {
      await sendMsg(`⚠️ Akun nomor ${i+1} tidak ada.`);
      return;
    }
    const namaLama = accounts[i];
    accounts[i] = gantiMatch[2].trim();
    await sendMsg(`✏️ <b>${namaLama}</b> → <b>${accounts[i]}</b> berhasil diganti.`);
    return;
  }

  await sendMsg('❓ Perintah tidak dikenal.\n\nKetik /start untuk lihat semua akun.');
});

app.get('/', (req, res) => res.send('Gemini Timer Bot aktif ✅'));

app.get('/health', (req, res) => res.send('OK'));

async function setWebhook() {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (!domain) return console.log('RAILWAY_PUBLIC_DOMAIN belum diset');
  const webhookUrl = `https://${domain}/webhook`;
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl })
  });
  const d = await r.json();
  console.log('Webhook set:', d.description);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server jalan di port ${PORT}`);
  await setWebhook();
});
