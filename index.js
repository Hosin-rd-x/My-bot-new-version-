// ==================== Imports ====================
const express = require('express');
const app = express();

app.use(express.json());

// ==================== Configuration ====================

const BOT_TOKEN = "8661537968:AAFpJxUhmrE4z45Wlypz9A4Zok7akOVsq2U";
const BALE_BOT_TOKEN = "786960754:lNIltoJUrKvrxKwH9vnZKWTdBJnm1-g7Mjc";

const BOT_WEBHOOK = "/endpoint";

// User Mapping
const USER_MAPPING = {
  "1200622005": "1610766617",
};

// حداکثر حجم (می‌تونی تغییر بدی)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ==================== Routes ====================

// Webhook
app.post(BOT_WEBHOOK, async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      await processMessage(update.message);
    }

    res.send('OK');
  } catch (err) {
    console.error(err);
    res.send('ERROR');
  }
});

// Register Webhook
app.get('/registerWebhook', async (req, res) => {
  const webhookUrl = `https://${req.headers.host}${BOT_WEBHOOK}`;

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl })
  });

  const data = await response.text();
  res.send(data);
});

// Ping route (برای جلوگیری از sleep)
app.get('/ping', (req, res) => {
  res.send('OK');
});

// ==================== Message Processing ====================

async function processMessage(message) {
  const userId = message.chat.id.toString();
  const recipientId = USER_MAPPING[userId];

  if (!recipientId) {
    await sendMessage(userId, message.message_id, '⛔ You are not authorized.');
    return;
  }

  if (message.text === '/start') {
    await sendMessage(userId, message.message_id,
      '👋 Welcome!\n\nSend a file to forward.\nMax size: 50MB'
    );
    return;
  }

  if (message.document) {
    await handleFileTransfer(userId, recipientId, message.document);
    return;
  }

  if (message.photo) {
    await handlePhotoTransfer(userId, recipientId, message.photo);
    return;
  }

  if (message.video) {
    await handleVideoTransfer(userId, recipientId, message.video);
    return;
  }

  if (message.audio) {
    await handleAudioTransfer(userId, recipientId, message.audio);
    return;
  }

  await sendMessage(userId, message.message_id, '⛔ Send a file.');
}

// ==================== Transfer Functions ====================

async function handleFileTransfer(senderId, recipientId, document) {
  if (document.file_size > MAX_FILE_SIZE) {
    return sendMessage(senderId, null, '⛔ File too large.');
  }

  try {
    await sendMessage(senderId, null, '⏳ Processing...');

    const file = await getFile(document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const fileResponse = await fetch(fileUrl);

    const formData = new FormData();
    formData.append('chat_id', recipientId);
    formData.append('document', fileResponse.body, document.file_name || 'file');

    const res = await fetch(`https://tapi.bale.ai/bot${BALE_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const result = await res.json();

    if (result.ok) {
      await sendMessage(senderId, null, '✅ Sent successfully');
    } else {
      await sendMessage(senderId, null, '⛔ Error sending file');
    }

  } catch (err) {
    console.error(err);
    await sendMessage(senderId, null, '⛔ Transfer error');
  }
}

// ==================== Other Media ====================

async function handlePhotoTransfer(senderId, recipientId, photos) {
  const photo = photos[photos.length - 1];

  const file = await getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

  const fileResponse = await fetch(fileUrl);

  const formData = new FormData();
  formData.append('chat_id', recipientId);
  formData.append('photo', fileResponse.body, 'photo.jpg');

  await fetch(`https://tapi.bale.ai/bot${BALE_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: formData
  });

  await sendMessage(senderId, null, '✅ Photo sent');
}

async function handleVideoTransfer(senderId, recipientId, video) {
  if (video.file_size > MAX_FILE_SIZE) {
    return sendMessage(senderId, null, '⛔ Video too large.');
  }

  const file = await getFile(video.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

  const fileResponse = await fetch(fileUrl);

  const formData = new FormData();
  formData.append('chat_id', recipientId);
  formData.append('video', fileResponse.body, 'video.mp4');

  await fetch(`https://tapi.bale.ai/bot${BALE_BOT_TOKEN}/sendVideo`, {
    method: 'POST',
    body: formData
  });

  await sendMessage(senderId, null, '✅ Video sent');
}

async function handleAudioTransfer(senderId, recipientId, audio) {
  if (audio.file_size > MAX_FILE_SIZE) {
    return sendMessage(senderId, null, '⛔ Audio too large.');
  }

  const file = await getFile(audio.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

  const fileResponse = await fetch(fileUrl);

  const formData = new FormData();
  formData.append('chat_id', recipientId);
  formData.append('audio', fileResponse.body, audio.file_name || 'audio.mp3');

  await fetch(`https://tapi.bale.ai/bot${BALE_BOT_TOKEN}/sendAudio`, {
    method: 'POST',
    body: formData
  });

  await sendMessage(senderId, null, '✅ Audio sent');
}

// ==================== Telegram API ====================

async function sendMessage(chatId, replyId, text) {
  const body = {
    chat_id: chatId,
    text: text
  };

  if (replyId) body.reply_to_message_id = replyId;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function getFile(fileId) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const data = await res.json();
  return data.result;
}

// ==================== Server ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});