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
let userStates = {}; // لتتبع حالة المستخدم

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
            [{ text: '➕ إضافة مشرف' }, { text: '🗑️ حذف مشرف' }],
            [{ text: '👥 عرض المشرفين' }, { text: '🏠 الرئيسية' }]
        ],
        resize_keyboard: true
    };
}

// لوحة الإلغاء
function cancelKeyboard() {
    return {
        keyboard: [[{ text: '❌ إلغاء' }]],
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

        // التعامل مع حالة الإلغاء
        if (text === '❌ إلغاء') {
            delete userStates[userId];
            await sendMessage(chatId, '✅ تم الإلغاء', mainKeyboard());
            return res.send('OK');
        }

        // التحقق من حالة المستخدم أولاً
        if (userStates[userId]) {
            const state = userStates[userId];
            
            if (state.step === 'awaiting_product_name') {
                state.productData = { name: text };
                state.step = 'awaiting_product_price';
                await sendMessage(chatId, '💰 الرجاء إدخال سعر المنتج:', cancelKeyboard());
                return res.send('OK');
            }
            
            else if (state.step === 'awaiting_product_price') {
                if (isNaN(text)) {
                    await sendMessage(chatId, '❌ الرجاء إدخال سعر صحيح (أرقام فقط):', cancelKeyboard());
                    return res.send('OK');
                }
                state.productData.price = parseInt(text);
                state.step = 'awaiting_product_description';
                await sendMessage(chatId, '📝 الرجاء إدخال وصف المنتج:', cancelKeyboard());
                return res.send('OK');
            }
            
            else if (state.step === 'awaiting_product_description') {
                state.productData.description = text;
                state.step = 'awaiting_product_image';
                await sendMessage(chatId, 
                    '🖼️ الرجاء إرسال صورة للمنتج (اختياري):\n\n' +
                    'يمكنك:\n' +
                    '• إرسال صورة مباشرة\n' +
                    '• أو كتابة "تخطي" للمتابعة بدون صورة',
                    cancelKeyboard()
                );
                return res.send('OK');
            }
            
            else if (state.step === 'awaiting_product_image') {
                // إذا كتب "تخطي" أو أي نص آخر
                if (text.toLowerCase() === 'تخطي') {
                    state.productData.image = 'https://via.placeholder.com/300x200/3498db/ffffff?text=لا+توجد+صورة';
                    await completeProductAddition(chatId, userId, state.productData);
                    delete userStates[userId];
                }
                return res.send('OK');
            }
            
            else if (state.step === 'awaiting_delete_product_number') {
                if (isNaN(text) || parseInt(text) < 1 || parseInt(text) > products.length) {
                    await sendMessage(chatId, `❌ الرجاء إدخال رقم صحيح بين 1 و ${products.length}:`, cancelKeyboard());
                    return res.send('OK');
                }
                
                const productIndex = parseInt(text) - 1;
                const deletedProduct = products.splice(productIndex, 1)[0];
                
                await sendMessage(chatId, 
                    `✅ <b>تم حذف المنتج:</b>\n\n` +
                    `📦 ${deletedProduct.name}\n` +
                    `💰 ${deletedProduct.price} دينار\n` +
                    `📝 ${deletedProduct.description}`,
                    productsKeyboard()
                );
                
                delete userStates[userId];
                return res.send('OK');
            }
        }

        // التعامل مع الصور المرسلة
        if (message.photo && userStates[userId] && userStates[userId].step === 'awaiting_product_image') {
            const state = userStates[userId];
            const photo = message.photo[message.photo.length - 1];
            const fileId = photo.file_id;
            
            // حفظ معرف الصورة فقط (في بيئة حقيقية تحتاج لتحميل الصورة)
            state.productData.image = fileId;
            await completeProductAddition(chatId, userId, state.productData);
            delete userStates[userId];
            return res.send('OK');
        }

        // الأوامر النصية والأزرار
        if (text === '/start' || text === '🏠 الرئيسية') {
            delete userStates[userId];
            await sendMessage(chatId, 
                '🎯 <b>مرحباً في لوحة تحكم مكتبة الفرزدق</b>\n\n' +
                'اختر من الأزرار أدناه:', 
                mainKeyboard()
            );
        }

        else if (text === '🛍️ عرض المنتجات' || text === '/listproducts') {
            delete userStates[userId];
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
            delete userStates[userId];
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
            delete userStates[userId];
            await sendMessage(chatId, '👥 <b>إدارة المشرفين:</b>', adminsKeyboard());
        }

        else if (text === '👥 عرض المشرفين' || text === '/listadmins') {
            delete userStates[userId];
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
            delete userStates[userId];
            await sendMessage(chatId, 
                '🧾 <b>الأوامر المتاحة:</b>\n\n' +
                '🛍️ <b>إدارة المنتجات:</b>\n' +
                '• 🛍️ عرض المنتجات\n' +
                '• ➕ إضافة منتج\n' + 
                '• 🗑️ حذف منتج\n' +
                '• 📊 الإحصائيات\n\n' +
                '👥 <b>إدارة المشرفين:</b>\n' +
                '• 👥 عرض المشرفين\n' +
                '• ➕ إضافة مشرف\n' +
                '• 🗑️ حذف مشرف',
                mainKeyboard()
            );
        }

        // ➕ إضافة منتج
        else if (text === '➕ إضافة منتج') {
            userStates[userId] = {
                step: 'awaiting_product_name',
                productData: {}
            };
            await sendMessage(chatId, 
                '📦 <b>إضافة منتج جديد</b>\n\n' +
                'الرجاء إدخال اسم المنتج:',
                cancelKeyboard()
            );
        }

        // 🗑️ حذف منتج
        else if (text === '🗑️ حذف منتج') {
            if (products.length === 0) {
                await sendMessage(chatId, '📦 لا توجد منتجات لحذفها', productsKeyboard());
                return res.send('OK');
            }
            
            let message = '🗑️ <b>اختر رقم المنتج للحذف:</b>\n\n';
            products.forEach((product, index) => {
                message += `${index + 1}. ${product.name} - ${product.price} دينار\n`;
            });
            
            message += `\n📝 <b>أرسل رقم المنتج الذي تريد حذفه (1-${products.length}):</b>`;
            
            userStates[userId] = {
                step: 'awaiting_delete_product_number'
            };
            
            await sendMessage(chatId, message, cancelKeyboard());
        }

        // ➕ إضافة مشرف
        else if (text === '➕ إضافة مشرف' || text.startsWith('/addadmin')) {
            delete userStates[userId];
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

        // 🗑️ حذف مشرف
        else if (text === '🗑️ حذف مشرف' || text.startsWith('/removeadmin')) {
            delete userStates[userId];
            if (text === '🗑️ حذف مشرف') {
                if (admins.length <= 1) {
                    await sendMessage(chatId, '❌ لا يمكن حذف جميع المشرفين', adminsKeyboard());
                    return res.send('OK');
                }
                
                let message = '🗑️ <b>اختر مشرف للحذف:</b>\n\n';
                admins.forEach((adminId, index) => {
                    if (adminId !== userId) {
                        message += `${index + 1}. <code>/removeadmin ${adminId}</code>\n`;
                    }
                });
                
                await sendMessage(chatId, message, adminsKeyboard());
            } else {
                const adminIdToRemove = text.replace('/removeadmin', '').trim();
                
                if (!adminIdToRemove) {
                    await sendMessage(chatId, 
                        '⚠️ استخدم: <code>/removeadmin رقم_المشرف</code>',
                        adminsKeyboard()
                    );
                    return res.send('OK');
                }

                if (adminIdToRemove === userId) {
                    await sendMessage(chatId, 
                        '❌ لا يمكنك حذف نفسك',
                        adminsKeyboard()
                    );
                    return res.send('OK');
                }

                if (admins.length <= 1) {
                    await sendMessage(chatId, 
                        '❌ لا يمكن حذف آخر مشرف في النظام',
                        adminsKeyboard()
                    );
                    return res.send('OK');
                }

                const index = admins.indexOf(adminIdToRemove);
                if (index === -1) {
                    await sendMessage(chatId, 
                        `❌ المشرف ${adminIdToRemove} غير موجود`,
                        adminsKeyboard()
                    );
                    return res.send('OK');
                }

                admins.splice(index, 1);
                await sendMessage(chatId, 
                    `✅ <b>تم حذف المشرف:</b>\n\n` +
                    `👤 الرقم: ${adminIdToRemove}\n` +
                    `📊 عدد المشرفين المتبقين: ${admins.length}`,
                    adminsKeyboard()
                );
            }
        }

        else {
            delete userStates[userId];
            await sendMessage(chatId, '❌ أمر غير معروف', mainKeyboard());
        }

    } catch (error) {
        console.error('❌ خطأ:', error);
    }
    res.send('OK');
});

// دالة لإكمال إضافة المنتج
async function completeProductAddition(chatId, userId, productData) {
    const newProduct = {
        id: Date.now(),
        name: productData.name,
        price: productData.price,
        description: productData.description,
        image: productData.image,
        category: 'general'
    };

    products.push(newProduct);

    await sendMessage(chatId, 
        `✅ <b>تم إضافة المنتج بنجاح!</b>\n\n` +
        `📦 <b>الاسم:</b> ${newProduct.name}\n` +
        `💰 <b>السعر:</b> ${newProduct.price} دينار\n` +
        `📝 <b>الوصف:</b> ${newProduct.description}\n` +
        `🖼️ <b>الصورة:</b> ${newProduct.image.includes('http') ? 'مرفوعة' : 'مرسلة'}`,
        productsKeyboard()
    );
}

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
        adminsCount: admins.length
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
    console.log(`👥 عدد المشرفين: ${admins.length}`);
});
