import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// 🔥 CORS يدوي بدون حاجة لتثبيت حزم إضافية
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// معالجة طلبات OPTIONS لـ CORS
app.options('*', (req, res) => {
    res.sendStatus(200);
});

const TOKEN = process.env.TOKEN  '8034752014:AAHvCAZ-_NKynT_NMtATy2XrKuZagpMKnv0';
const ADMIN_ID = process.env.ADMIN_ID  '5044802006';

let products = [];
let admins = [ADMIN_ID];

async function sendMessage(chatId, text, replyMarkup = null) {
    try {
        await axios.post(https://api.telegram.org/bot${TOKEN}/sendMessage, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
        });
    } catch (error) {
        console.log('❌ خطأ في الإرسال:', error.message);
    }
}

function isAdmin(userId) {
    return admins.includes(userId.toString());
}

// لوحة التحكم الرئيسية
function mainKeyboard() {
    return {
        keyboard: [
            [{ text: '🛍 عرض المنتجات' }, { text: '📊 الإحصائيات' }],
            [{ text: '👥 إدارة المشرفين' }, { text: '❓ المساعدة' }]
        ],
        resize_keyboard: true
    };
}

// لوحة إدارة المنتجات
function productsKeyboard() {
    return {
        keyboard: [
            [{ text: '➕ إضافة منتج' }, { text: '🗑 حذف منتج' }],
            [{ text: '🛍 عرض المنتجات' }, { text: '📊 الإحصائيات' }],
            [{ text: '🏠 الرئيسية' }]
        ],
        resize_keyboard: true
    };
}

// لوحة إدارة المشرفين
function adminsKeyboard() {
    return {
        keyboard: [
            [{ text: '➕ إضافة مشرف' }, { text: '🗑 حذف مشرف' }],
            [{ text: '👥 عرض المشرفين' }, { text: '🏠 الرئيسية' }]
        ],
        resize_keyboard: true
    };
}

app.post('/webhook', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.text) return res.send('OK');
        
        const chatId = message.chat.id;
        const text = message.text;
        const userId = message.from.id.toString();
