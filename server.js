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
let userStates = {};

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

// حالة المستخدم لإدارة تدفق إضافة المنتج
function setUserState(chatId, state, data = {}) {
    userStates[chatId] = { state, data };
}

function getUserState(chatId) {
    return userStates[chatId];
}

function clearUserState(chatId) {
    delete userStates[chatId];
}

// عرض المنتجات مع أرقام تسلسلية
function displayProducts() {
    if (products.length === 0) {
        return '❌ لا توجد منتجات حالياً.';
    }
    
    let productsList = '🛍️ <b>قائمة المنتجات:</b>\n\n';
    products.forEach((product, index) => {
        productsList += `📦 <b>المنتج ${index + 1}:</b>\n`;
        productsList += `   🏷️ <b>الاسم:</b> ${product.name}\n`;
        productsList += `   📝 <b>الوصف:</b> ${product.description}\n`;
        productsList += `   💰 <b>السعر:</b> ${product.price}\n`;
        if (product.image) {
            productsList += `   🖼️ <b>الصورة:</b> متوفرة\n`;
        }
        productsList += '\n' + '─'.repeat(30) + '\n\n';
    });
    return productsList;
}

app.post('/webhook', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.text) return res.send('OK');
        
        const chatId = message.chat.id;
        const text = message.text;
        const userId = message.from.id.toString();

        // التحقق من صلاحية المشرف
        if (!isAdmin(userId)) {
            await sendMessage(chatId, '❌ ليس لديك صلاحية للوصول إلى هذا البوت.');
            return res.send('OK');
        }

        // التعامل مع حالة الإلغاء
        if (text === '❌ إلغاء') {
            clearUserState(chatId);
            await sendMessage(chatId, '✅ تم الإلغاء.', mainKeyboard());
            return res.send('OK');
        }

        // التعامل مع حالات إضافة المنتج
        const userState = getUserState(chatId);
        if (userState && userState.state === 'awaiting_product_name') {
            setUserState(chatId, 'awaiting_product_image', { 
                ...userState.data, 
                name: text 
            });
            await sendMessage(chatId, '📝 تم حفظ الاسم.\n\n🖼️ الآن أرسل صورة المنتج (اختياري) أو اضغط /skip لتخطي هذه الخطوة:', cancelKeyboard());
            return res.send('OK');
        }

        if (userState && userState.state === 'awaiting_product_image') {
            if (text === '/skip') {
                setUserState(chatId, 'awaiting_product_description', {
                    ...userState.data,
                    image: null
                });
                await sendMessage(chatId, '✅ تم تخطي إضافة الصورة.\n\n📝 الآن أرسل وصف المنتج:', cancelKeyboard());
            } else if (message.photo) {
                const photo = message.photo[message.photo.length - 1];
                setUserState(chatId, 'awaiting_product_description', {
                    ...userState.data,
                    image: photo.file_id
                });
                await sendMessage(chatId, '✅ تم حفظ الصورة.\n\n📝 الآن أرسل وصف المنتج:', cancelKeyboard());
            } else {
                await sendMessage(chatId, '❌ يرجى إرسال صورة صالحة أو استخدام /skip لتخطي هذه الخطوة.', cancelKeyboard());
            }
            return res.send('OK');
        }

        if (userState && userState.state === 'awaiting_product_description') {
            setUserState(chatId, 'awaiting_product_price', {
                ...userState.data,
                description: text
            });
            await sendMessage(chatId, '✅ تم حفظ الوصف.\n\n💰 الآن أرسل سعر المنتج:', cancelKeyboard());
            return res.send('OK');
        }

        if (userState && userState.state === 'awaiting_product_price') {
            const price = text.trim();
            if (!price || isNaN(price)) {
                await sendMessage(chatId, '❌ يرجى إدخال سعر صحيح.', cancelKeyboard());
                return res.send('OK');
            }

            // حفظ المنتج النهائي
            const productData = userState.data;
            const newProduct = {
                id: Date.now(),
                name: productData.name,
                description: productData.description,
                price: price,
                image: productData.image || null,
                createdAt: new Date().toISOString()
            };

            products.push(newProduct);
            clearUserState(chatId);

            let productInfo = `✅ <b>تم إضافة المنتج بنجاح!</b>\n\n`;
            productInfo += `🏷️ <b>الاسم:</b> ${newProduct.name}\n`;
            productInfo += `📝 <b>الوصف:</b> ${newProduct.description}\n`;
            productInfo += `💰 <b>السعر:</b> ${newProduct.price}\n`;
            productInfo += `🖼️ <b>الصورة:</b> ${newProduct.image ? 'متوفرة' : 'غير متوفرة'}`;

            await sendMessage(chatId, productInfo, productsKeyboard());
            return res.send('OK');
        }

        // التعامل مع الأوامر الرئيسية
        switch (text) {
            case '/start':
            case '🏠 الرئيسية':
                await sendMessage(chatId, 'مرحباً بك في لوحة التحكم!', mainKeyboard());
                break;

            case '🛍️ عرض المنتجات':
                await sendMessage(chatId, displayProducts(), productsKeyboard());
                break;

            case '➕ إضافة منتج':
                setUserState(chatId, 'awaiting_product_name', {});
                await sendMessage(chatId, '🚀 بدء إضافة منتج جديد...\n\n🏷️ أرسل اسم المنتج:', cancelKeyboard());
                break;

            case '🗑️ حذف منتج':
                if (products.length === 0) {
                    await sendMessage(chatId, '❌ لا توجد منتجات لحذفها.', productsKeyboard());
                } else {
                    await sendMessage(chatId, 
                        `${displayProducts()}\n\n🗑️ <b>أرسل رقم المنتج الذي تريد حذفه:</b>\n(مثال: 1 لحذف المنتج الأول)`, 
                        cancelKeyboard()
                    );
                }
                break;

            case '📊 الإحصائيات':
                const stats = `📊 <b>الإحصائيات:</b>\n\n` +
                             `🛍️ <b>عدد المنتجات:</b> ${products.length}\n` +
                             `👥 <b>عدد المشرفين:</b> ${admins.length}\n` +
                             `📅 <b>آخر تحديث:</b> ${new Date().toLocaleString()}`;
                await sendMessage(chatId, stats, mainKeyboard());
                break;

            case '👥 إدارة المشرفين':
                await sendMessage(chatId, '👥 لوحة إدارة المشرفين', adminsKeyboard());
                break;

            case '👥 عرض المشرفين':
                const adminsList = admins.map((admin, index) => `${index + 1}. ${admin}`).join('\n');
                await sendMessage(chatId, `👥 <b>قائمة المشرفين:</b>\n\n${adminsList}`, adminsKeyboard());
                break;

            case '➕ إضافة مشرف':
                await sendMessage(chatId, 'أرسل معرف المشرف الجديد (User ID):', adminsKeyboard());
                break;

            case '🗑️ حذف مشرف':
                if (admins.length <= 1) {
                    await sendMessage(chatId, '❌ لا يمكن حذف جميع المشرفين.', adminsKeyboard());
                } else {
                    const adminsListForDelete = admins.map((admin, index) => `${index + 1}. ${admin}`).join('\n');
                    await sendMessage(chatId, `👥 <b>قائمة المشرفين:</b>\n\n${adminsListForDelete}\n\nأرسل رقم المشرف الذي تريد حذفه:`, adminsKeyboard());
                }
                break;

            case '❓ المساعدة':
                await sendMessage(chatId, 
                    '📖 <b>دليل الاستخدام:</b>\n\n' +
                    '🛍️ <b>عرض المنتجات:</b> عرض جميع المنتجات\n' +
                    '➕ <b>إضافة منتج:</b> إضافة منتج جديد\n' +
                    '🗑️ <b>حذف منتج:</b> حذف منتج موجود\n' +
                    '👥 <b>إدارة المشرفين:</b> إضافة/حذف مشرفين\n' +
                    '📊 <b>الإحصائيات:</b> عرض إحصائيات البوت',
                    mainKeyboard()
                );
                break;

            default:
                // التعامل مع حذف المنتج برقم
                if (!isNaN(text) && products.length > 0) {
                    const productIndex = parseInt(text) - 1;
                    if (productIndex >= 0 && productIndex < products.length) {
                        const deletedProduct = products.splice(productIndex, 1)[0];
                        await sendMessage(chatId, 
                            `✅ <b>تم حذف المنتج بنجاح!</b>\n\n` +
                            `🏷️ <b>الاسم:</b> ${deletedProduct.name}\n` +
                            `💰 <b>السعر:</b> ${deletedProduct.price}`,
                            productsKeyboard()
                        );
                    } else {
                        await sendMessage(chatId, '❌ رقم المنتج غير صحيح.', productsKeyboard());
                    }
                    return res.send('OK');
                }

                // التعامل مع إضافة مشرف برقم
                if (!isNaN(text) && text.length > 5) {
                    if (!admins.includes(text)) {
                        admins.push(text);
                        await sendMessage(chatId, `✅ تم إضافة المشرف ${text} بنجاح`, adminsKeyboard());
                    } else {
                        await sendMessage(chatId, '❌ المشرف موجود مسبقاً', adminsKeyboard());
                    }
                    return res.send('OK');
                }

                // التعامل مع حذف مشرف برقم
                if (!isNaN(text) && text.length <= 2) {
                    const adminIndex = parseInt(text) - 1;
                    if (adminIndex >= 0 && adminIndex < admins.length) {
                        if (admins[adminIndex] === ADMIN_ID) {
                            await sendMessage(chatId, '❌ لا يمكن حذف المشرف الرئيسي', adminsKeyboard());
                        } else {
                            const deletedAdmin = admins.splice(adminIndex, 1)[0];
                            await sendMessage(chatId, `✅ تم حذف المشرف ${deletedAdmin} بنجاح`, adminsKeyboard());
                        }
                    } else {
                        await sendMessage(chatId, '❌ رقم المشرف غير صحيح', adminsKeyboard());
                    }
                    return res.send('OK');
                }

                await sendMessage(chatId, '❌ أمر غير معروف!', mainKeyboard());
        }

        res.send('OK');
    } catch (error) {
        console.log('❌ خطأ في معالجة الطلب:', error);
        res.send('OK');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 البوت يعمل على المنفذ ${PORT}`);
});
