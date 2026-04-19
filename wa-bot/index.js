const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '../wa_session' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
});

let isClientReady = false;
let latestQR = null;          // raw QR string for web UI
const messageCache = []; // Store messages in RAM

client.on('qr', (qr) => {
    latestQR = qr;
    qrcode.generate(qr, { small: true });
    console.log('\n[wa-bot] 📱 Отсканируйте этот QR-код в WhatsApp\n');
});

client.on('authenticated', () => {
    console.log('[wa-bot] 🔑 Authenticated! Session is valid.');
});

client.on('auth_failure', (msg) => {
    console.error('[wa-bot] ❌ Authentication failure:', msg);
    isClientReady = false;
});

client.on('loading_screen', (percent, message) => {
    console.log(`[wa-bot] ⌛ Loading: ${percent}% - ${message}`);
});

client.on('ready', () => {
    isClientReady = true;
    latestQR = null; // Clear QR once authenticated
    console.log('[wa-bot] ✅ WhatsApp Client is ready and listening!');
});

client.on('disconnected', (reason) => {
    isClientReady = false;
    console.log('[wa-bot] ❌ WhatsApp Client disconnected:', reason);
});

// Passively listen to all incoming and outgoing messages
client.on('message_create', async (msg) => {
    try {
        const chat = await msg.getChat();
        if (!chat.isGroup) return; // Only cache groups
        
        let senderName = "Неизвестно";
        try {
            const contact = await msg.getContact();
            senderName = contact.pushname || contact.name || contact.number || "Неизвестно";
        } catch (contactError) {
            console.warn("[wa-bot] Failed to get contact info, using ID fallback:", contactError.message);
            senderName = msg.author || msg.from || "Неизвестно";
        }
        const timestampDate = new Date(msg.timestamp * 1000);
        
        messageCache.push({
            group_name: chat.name,
            platform: "whatsapp_web",
            sender: senderName,
            text: msg.body,
            direction: msg.fromMe ? "out" : "in",
            timestamp_iso: timestampDate.toISOString(),
            time: timestampDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            meta_raw: `[${timestampDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}, ${timestampDate.toLocaleDateString('ru-RU')}] ${senderName}:`
        });
        
        // Keep max 500 to avoid memory leak
        if (messageCache.length > 500) messageCache.shift();
    } catch(e) {
        console.error("Message cache error:", e);
    }
});

client.initialize();

app.get('/messages', async (req, res) => {
    if (!isClientReady) {
        return res.status(503).json({ error: 'WhatsApp client is not ready yet' });
    }
    
    const targetGroupName = req.query.group_name;
    const limit = parseInt(req.query.limit) || 100;
    
    if (!targetGroupName) {
        return res.status(400).json({ error: 'group_name is required' });
    }

    try {
        const filtered = messageCache.filter(m => 
            m.group_name.toLowerCase() === targetGroupName.toLowerCase() || 
            m.group_name.toLowerCase().includes(targetGroupName.toLowerCase())
        );
        
        return res.json({ messages: filtered.slice(-limit) });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message });
    }
});

app.get('/chats', async (req, res) => {
    if (!client) {
        return res.status(500).json({ error: 'WhatsApp client not initialized' });
    }
    if (!isClientReady) {
        return res.status(503).json({ error: 'WhatsApp client is not ready yet', isReady: false });
    }
    try {
        const chats = await client.getChats();
        const names = chats.map(c => ({name: c.name, isGroup: c.isGroup}));
        res.json({chats: names});
    } catch(e) {
        console.error('[wa-bot] Chats error:', e);
        res.status(500).json({error: e.message});
    }
});

app.get('/status', (req, res) => {
    res.json({ 
        isReady: isClientReady, 
        hasQR: latestQR !== null,
        qr: latestQR,
        cacheSize: messageCache.length
    });
});

app.post('/send', async (req, res) => {
    if (!isClientReady) {
        return res.status(503).json({ error: 'WhatsApp client is not ready yet' });
    }
    const { group_name, message } = req.body;
    if (!group_name || !message) {
        return res.status(400).json({ error: 'group_name and message are required' });
    }
    try {
        const chats = await client.getChats();
        const target = chats.find(c => c.isGroup && (
            c.name.toLowerCase() === group_name.toLowerCase() ||
            c.name.toLowerCase().includes(group_name.toLowerCase())
        ));
        if (!target) {
            const allGroups = chats.filter(c => c.isGroup).map(c => c.name).join(', ');
            console.warn(`[wa-bot] ⚠️ Group '${group_name}' not found. Available groups: ${allGroups}`);
            return res.status(404).json({ error: `Group '${group_name}' not found. Available groups: ${allGroups}` });
        }
        await target.sendMessage(message);
        console.log(`[wa-bot] 📤 Sent to '${target.name}': ${message.substring(0, 60)}...`);
        return res.json({ success: true, group: target.name });
    } catch (e) {
        console.error('[wa-bot] Send error:', e);
        return res.status(500).json({ error: e.message });
    }
});

app.listen(3001, () => {
    console.log('[wa-bot] 🌐 API server listening on port 3001');
});
