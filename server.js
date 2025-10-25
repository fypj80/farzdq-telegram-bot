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

const TOKEN = process.env.TOKEN || '8034752014:AAHvCAZ-_NKynT_NMtATy2XrKuZagpMKnv0';
const ADMIN_ID = process.env.ADMIN_ID || '5044802006';

let products = [];
let admins = [ADMIN_ID];

async function sendMessage(chatId, text, replyMarkup = null) {
    try {
        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
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
            [{ text: '🛍️ عرض المنتجات' }, { text: '📊 الإحصائيات' }],
            [{ text: '👥 إدارة المشرفين' }, { text: '❓ المساعدة' }]
        ],
        resize_keyboard: true
    };
}

// لوحة إدارة المنتجات
function productsKeyboard() {
    return {
        keyboard: [
            [{ text: '➕ إضافة منتج' }, { text: '🗑️ حذف منتج' }],
            [{ text: '🛍️ عرض المنتجات' }, { text: '📊 الإحصائيات' }],
            [{ text: '🏠 الرئيسية' }]
        ],
        resize_keyboard: true
    };
}

// لوحة إدارة المشرفين
function adminsKeyboard() {
    return {
        keyboard: [
            [{ text: '➕ إضافة مشرف' }, { text: '👥 عرض المشرفين' }],
            [{ text: '🏠 الرئيسية' }]
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

        if (!isAdmin(userId)) {
            await sendMessage(chatId, '❌ ليس لديك صلاحية للتحكم');
            return res.send('OK');
        }

        // الأوامر النصية والأزرار
        if (text === '/start' || text === '🏠 الرئيسية') {
            await sendMessage(chatId, 
                '🎯 <b>مرحباً في لوحة تحكم مكتبة الفرزدق</b>\n\n' +
                'اختر من الأزرار أدناه:', 
                mainKeyboard()
            );
        }

        else if (text === '🛍️ عرض المنتجات' || text === '/listproducts') {
            if (products.length === 0) {
                await sendMessage(chatId, '📦 لا توجد منتجات', productsKeyboard());
            } else {
                let message = '🛍️ <b>المنتجات:</b>\n\n';
                products.forEach((product, index) => {
                    message += `${index + 1}. ${product.name} - ${product.price} دينار\n`;
                });
                await sendMessage(chatId, message, productsKeyboard());
            }
        }

        else if (text === '📊 الإحصائيات' || text === '/stats') {
            const totalProducts = products.length;
            const totalAdmins = admins.length;
            await sendMessage(chatId, 
                `📊 <b>الإحصائيات:</b>\n\n` +
                `🛍️ عدد المنتجات: ${totalProducts}\n` +
                `👥 عدد المشرفين: ${totalAdmins}`,
                mainKeyboard()
            );
        }

        else if (text === '👥 إدارة المشرفين') {
            await sendMessage(chatId, '👥 <b>إدارة المشرفين:</b>', adminsKeyboard());
        }

        else if (text === '👥 عرض المشرفين' || text === '/listadmins') {
            if (admins.length === 0) {
                await sendMessage(chatId, '👥 لا يوجد مشرفين', adminsKeyboard());
            } else {
                let message = '👥 <b>قائمة المشرفين:</b>\n\n';
                admins.forEach((adminId, index) => {
                    const isYou = adminId === userId ? ' (أنت)' : '';
                    message += `${index + 1}. ${adminId}${isYou}\n`;
                });
                await sendMessage(chatId, message, adminsKeyboard());
            }
        }

        else if (text === '❓ المساعدة' || text === '/help') {
            await sendMessage(chatId, 
                '🧾 <b>الأوامر المتاحة:</b>\n\n' +
                '🛍️ <b>إدارة المنتجات:</b>\n' +
                '• 🛍️ عرض المنتجات\n' +
                '• ➕ إضافة منتج\n' + 
                '• 🗑️ حذف منتج\n' +
                '• 📊 الإحصائيات\n\n' +
                '👥 <b>إدارة المشرفين:</b>\n' +
                '• 👥 عرض المشرفين\n' +
                '• ➕ إضافة مشرف',
                mainKeyboard()
            );
        }

        // ➕ إضافة منتج
        else if (text === '➕ إضافة منتج' || text.startsWith('/addproduct')) {
            if (text === '➕ إضافة منتج') {
                await sendMessage(chatId, 
                    '📝 <b>إضافة منتج جديد:</b>\n\n' +
                    'استخدم الأمر:\n' +
                    '<code>/addproduct اسم~سعر~تصنيف~وصف~[صورة]</code>\n\n' +
                    'مثال:\n' +
                    '<code>/addproduct دفتر~2500~stationery~دفتر ملاحظات~https://example.com/image.jpg</code>',
                    productsKeyboard()
                );
            } else {
                const data = text.replace('/addproduct', '').trim();
                
                if (!data.includes('~')) {
                    await sendMessage(chatId, 
                        '⚠️ استخدم التنسيق:\n<code>/addproduct اسم~سعر~تصنيف~وصف~[صورة]</code>',
                        productsKeyboard()
                    );
                    return res.send('OK');
                }

                const parts = data.split('~');
                const name = parts[0];
                const price = parts[1];
                const category = parts[2];
                const description = parts[3];
                const image = parts[4];

                if (!['stationery', 'pens', 'papers'].includes(category)) {
                    await sendMessage(chatId, 
                        '⚠️ التصنيف غير صالح. المسموح: stationery, pens, papers',
                        productsKeyboard()
                    );
                    return res.send('OK');
                }

                const newProduct = {
                    id: Date.now(),
                    name,
                    price: parseInt(price),
                    category,
                    description,
                    image: image || 'https://via.placeholder.com/300x200/3498db/ffffff?text=منتج+جديد'
                };

                products.push(newProduct);

                await sendMessage(chatId, 
                    `✅ <b>تم إضافة المنتج:</b>\n\n` +
                    `📦 ${name}\n` +
                    `💰 ${price} دينار\n` +
                    `📁 ${category}\n` +
                    `📝 ${description}`,
                    productsKeyboard()
                );
            }
        }

        // ➕ إضافة مشرف
        else if (text === '➕ إضافة مشرف' || text.startsWith('/addadmin')) {
            if (text === '➕ إضافة مشرف') {
                await sendMessage(chatId, 
                    '👤 <b>إضافة مشرف جديد:</b>\n\n' +
                    'استخدم الأمر:\n' +
                    '<code>/addadmin رقم_المشرف</code>\n\n' +
                    'مثال:\n' +
                    '<code>/addadmin 123456789</code>',
                    adminsKeyboard()
                );
            } else {
                const newAdminId = text.replace('/addadmin', '').trim();
                
                if (!newAdminId) {
                    await sendMessage(chatId, 
                        '⚠️ استخدم: <code>/addadmin رقم_المشرف</code>',
                        adminsKeyboard()
                    );
                    return res.send('OK');
                }

                if (admins.includes(newAdminId)) {
                    await sendMessage(chatId, 
                        `❌ الرقم ${newAdminId} مشرف مسبقاً`,
                        adminsKeyboard()
                    );
                    return res.send('OK');
                }

                admins.push(newAdminId);
                await sendMessage(chatId, 
                    `✅ <b>تم إضافة المشرف:</b>\n\n` +
                    `👤 الرقم: ${newAdminId}\n` +
                    `📊 عدد المشرفين: ${admins.length}`,
                    adminsKeyboard()
                );
            }
        }

        // 🗑️ حذف منتج
        else if (text === '🗑️ حذف منتج' || text.startsWith('/deleteproduct')) {
            if (text === '🗑️ حذف منتج') {
                if (products.length === 0) {
                    await sendMessage(chatId, '📦 لا توجد منتجات لحذفها', productsKeyboard());
                    return res.send('OK');
                }
                
                let message = '🗑️ <b>اختر منتج للحذف:</b>\n\n';
                products.forEach((product, index) => {
                    message += `${index + 1}. <code>/deleteproduct ${product.name}</code>\n`;
                });
                
                await sendMessage(chatId, message, productsKeyboard());
            } else {
                const productName = text.replace('/deleteproduct', '').trim();
                
                if (!productName) {
                    await sendMessage(chatId, 
                        '⚠️ استخدم: <code>/deleteproduct اسم_المنتج</code>',
                        productsKeyboard()
                    );
                    return res.send('OK');
                }

                const index = products.findIndex(p => p.name === productName);
                if (index === -1) {
                    await sendMessage(chatId, 
                        `❌ المنتج "${productName}" غير موجود`,
                        productsKeyboard()
                    );
                    return res.send('OK');
                }

                const deletedProduct = products.splice(index, 1)[0];
                await sendMessage(chatId, 
                    `✅ <b>تم حذف المنتج:</b>\n\n` +
                    `📦 ${productName}\n` +
                    `💰 ${deletedProduct.price} دينار`,
                    productsKeyboard()
                );
            }
        }

        else {
            await sendMessage(chatId, '❌ أمر غير معروف', mainKeyboard());
        }

    } catch (error) {
        console.error('❌ خطأ:', error);
    }
    res.send('OK');
});

// 🔥 🔥 🔥 الـ API endpoints للواجهة 🔥 🔥 🔥

// 1. جلب جميع المنتجات
app.get('/api/products', (req, res) => {
    res.json({
        success: true,
        products: products
    });
});

// 2. التحقق من الاتصال
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'البوت شغال!',
        productsCount: products.length,
        timestamp: new Date().toISOString()
    });
});

// 3. الإحصائيات
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        totalProducts: products.length,
        totalAdmins: admins.length
    });
});

// 4. الصفحة الرئيسية
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 سيرفر مكتبة الفرزدق شغال!',
        endpoints: {
            health: '/api/health',
            products: '/api/products',
            stats: '/api/stats'
        }
    });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
    console.error('❌ خطأ في السيرفر:', err);
    res.status(500).json({
        success: false,
        message: 'خطأ داخلي في السيرفر'
    });
});

// 404 - صفحة غير موجودة
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'الصفحة غير موجودة'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ السيرفر شغال على البورت ${PORT}`);
    console.log(`🌐 رابط الصحة: http://localhost:${PORT}/api/health`);
    console.log(`🛍️ رابط المنتجات: http://localhost:${PORT}/api/products`);
});
