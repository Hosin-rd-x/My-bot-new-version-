// ==================== Imports ====================
const express = require("express");
const FormData = require("form-data");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// ==================== Configuration ====================

const BOT_TOKEN = process.env.BOT_TOKEN;
const BALE_BOT_TOKEN = process.env.BALE_BOT_TOKEN;

const BOT_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;
const BALE_API = `https://tapi.bale.ai/bot${BALE_BOT_TOKEN}`;

const BOT_WEBHOOK = "/endpoint";

const USER_MAPPING = {
  "1200622005": "1610766617",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ==================== Routes ====================

// webhook
app.post(BOT_WEBHOOK, async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      await processMessage(update.message);
    }

    res.send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    res.send("ERROR");
  }
});

// register webhook
app.get("/registerWebhook", async (req, res) => {
  try {
    const webhookUrl = `https://${req.headers.host}${BOT_WEBHOOK}`;

    const response = await fetch(`${BOT_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.send("ERROR");
  }
});

// health check
app.get("/ping", (req, res) => {
  res.send("OK");
});

// ==================== Message Handler ====================

async function processMessage(message) {
  const userId = String(message.chat.id);
  const recipientId = USER_MAPPING[userId];

  if (!recipientId) {
    return sendMessage(userId, "⛔ Not authorized.");
  }

  if (message.text === "/start") {
    return sendMessage(
      userId,
      "👋 Welcome!\nSend a file to forward.\nMax size: 50MB"
    );
  }

  if (message.document) {
    return handleFile(message, recipientId);
  }

  if (message.photo) {
    return handlePhoto(message, recipientId);
  }

  if (message.video) {
    return handleVideo(message, recipientId);
  }

  if (message.audio) {
    return handleAudio(message, recipientId);
  }

  return sendMessage(userId, "⛔ Send a file.");
}

// ==================== File Handlers ====================

async function handleFile(message, recipientId) {
  const doc = message.document;

  if (doc.file_size > MAX_FILE_SIZE) {
    return sendMessage(message.chat.id, "⛔ File too large.");
  }

  try {
    const file = await getFile(doc.file_id);
    const stream = await fetch(`${FILE_API}/${file.file_path}`);

    const form = new FormData();
    form.append("chat_id", recipientId);
    form.append("document", stream.body, doc.file_name || "file");

    const res = await fetch(`${BALE_API}/sendDocument`, {
      method: "POST",
      body: form,
    });

    const data = await res.json();

    if (data.ok) {
      sendMessage(message.chat.id, "✅ File sent");
    } else {
      sendMessage(message.chat.id, "⛔ Send failed");
    }
  } catch (err) {
    console.error(err);
    sendMessage(message.chat.id, "⛔ Error");
  }
}

async function handlePhoto(message, recipientId) {
  const photo = message.photo.at(-1);

  const file = await getFile(photo.file_id);
  const stream = await fetch(`${FILE_API}/${file.file_path}`);

  const form = new FormData();
  form.append("chat_id", recipientId);
  form.append("photo", stream.body, "photo.jpg");

  await fetch(`${BALE_API}/sendPhoto`, {
    method: "POST",
    body: form,
  });

  sendMessage(message.chat.id, "✅ Photo sent");
}

async function handleVideo(message, recipientId) {
  const video = message.video;

  if (video.file_size > MAX_FILE_SIZE) {
    return sendMessage(message.chat.id, "⛔ Video too large.");
  }

  const file = await getFile(video.file_id);
  const stream = await fetch(`${FILE_API}/${file.file_path}`);

  const form = new FormData();
  form.append("chat_id", recipientId);
  form.append("video", stream.body, "video.mp4");

  await fetch(`${BALE_API}/sendVideo`, {
    method: "POST",
    body: form,
  });

  sendMessage(message.chat.id, "✅ Video sent");
}

async function handleAudio(message, recipientId) {
  const audio = message.audio;

  if (audio.file_size > MAX_FILE_SIZE) {
    return sendMessage(message.chat.id, "⛔ Audio too large.");
  }

  const file = await getFile(audio.file_id);
  const stream = await fetch(`${FILE_API}/${file.file_path}`);

  const form = new FormData();
  form.append("chat_id", recipientId);
  form.append("audio", stream.body, audio.file_name || "audio.mp3");

  await fetch(`${BALE_API}/sendAudio`, {
    method: "POST",
    body: form,
  });

  sendMessage(message.chat.id, "✅ Audio sent");
}

// ==================== Telegram API ====================

async function sendMessage(chatId, text) {
  try {
    await fetch(`${BOT_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
  } catch (err) {
    console.error("sendMessage error:", err);
  }
}

async function getFile(fileId) {
  const res = await fetch(`${BOT_API}/getFile?file_id=${fileId}`);
  const data = await res.json();
  return data.result;
}

// ==================== Server ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});