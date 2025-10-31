import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// إعدادات البوت - استخدم المتغيرات البيئية
const TOKEN = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

// تخزين البيانات
let products = [];
let admins = [ADMIN_ID]; // إضافة الأدمن الأساسي

// تخزين حالة المستخدمين أثناء إضافة المنتجات
let userStates = {};

// دالة إرسال رسالة للتليجرام
async function sendMessage(chatId, text, replyMarkup = null) {
    try {
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        };

        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }

        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, payload);
    } catch (error) {
        console.log('❌ خطأ في الإرسال:', error.message);
    }
}

// دالة التحقق من صلاحية الأدمن
function isAdmin(userId) {
    return admins.includes(userId.toString());
}

// دالة إنشاء كيبورد للإلغاء فقط
function getCancelKeyboard() {
    return {
        keyboard: [[{ text: '❌ إلغاء' }]],
        resize_keyboard: true,
        one_time_keyboard: true
    };
}

// دالة إنشاء كيبورد للصور
function getImageKeyboard() {
    return {
        keyboard: [
            [{ text: '⏩ تخطي' }],
            [{ text: '❌ إلغاء' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    };
}

// دالة بدء عملية إضافة منتج
function startAddProduct(chatId) {
    userStates[chatId] = {
        state: 'awaiting_product_name',
        productData: {}
    };
    sendMessage(chatId, '📝 <b>أدخل اسم المنتج:</b>', getCancelKeyboard());
}

// دالة إلغاء عملية الإضافة
function cancelAddProduct(chatId) {
    delete userStates[chatId];
    sendMessage(chatId, '❌ <b>تم إلغاء إضافة المنتج</b>');
}

// استقبال رسائل التليجرام
app.post('/webhook', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.text) return res.send('OK');
        
        const chatId = message.chat.id;
        const text = message.text;
        const userId = message.from.id.toString();

        console.log(`📱 رسالة من ${userId}: ${text}`);

        // التحقق من المسؤول
        if (!isAdmin(userId)) {
            await sendMessage(chatId, '❌ ليس لديك صلاحية للتحكم');
            return res.send('OK');
        }

        // التحقق إذا المستخدم في حالة إضافة منتج
        if (userStates[chatId]) {
            const userState = userStates[chatId];
            
            // إلغاء في أي مرحلة
            if (text === '❌ إلغاء') {
                cancelAddProduct(chatId);
                return res.send('OK');
            }

            switch (userState.state) {
                case 'awaiting_product_name':
                    userState.productData.name = text;
                    userState.state = 'awaiting_product_price';
                    await sendMessage(chatId, '💰 <b>أدخل سعر المنتج:</b>\n\nمثال: 15000', getCancelKeyboard());
                    break;

                case 'awaiting_product_price':
                    // التحقق من أن السعر رقم
                    const price = parseFloat(text);
                    if (isNaN(price)) {
                        await sendMessage(chatId, '⚠️ <b>يرجى إدخال سعر صحيح!</b>\n\nمثال: 15000', getCancelKeyboard());
                        return;
                    }
                    userState.productData.price = price;
                    userState.state = 'awaiting_product_description';
                    await sendMessage(chatId, '📄 <b>أدخل وصف المنتج:</b>', getCancelKeyboard());
                    break;

                case 'awaiting_product_description':
                    userState.productData.description = text;
                    userState.state = 'awaiting_product_image';
                    await sendMessage(chatId, 
                        '🖼️ <b>أدخل رابط صورة المنتج:</b>\n\n' +
                        '• اضغط ⏩ تخطي إذا لم تكن هناك صورة\n' +
                        '• يجب أن يكون الرابط بصيغة: https://example.com/image.jpg', 
                        getImageKeyboard()
                    );
                    break;

                case 'awaiting_product_image':
                    if (text === '⏩ تخطي') {
                        userState.productData.image = '';
                    } else {
                        // تحقق بسيط من أن النص يشبه رابط
                        if (text.startsWith('http')) {
                            userState.productData.image = text;
                        } else {
                            await sendMessage(chatId, 
                                '⚠️ <b>يرجى إدخال رابط صحيح!</b>\n\n' +
                                'مثال: https://example.com/image.jpg\n' +
                                'أو اضغط ⏩ تخطي', 
                                getImageKeyboard()
                            );
                            return;
                        }
                    }

                    // حفظ المنتج
                    const product = {
                        id: Date.now(),
                        name: userState.productData.name,
                        price: userState.productData.price,
                        description: userState.productData.description,
                        image: userState.productData.image || '',
                        date: new Date().toLocaleDateString('ar-SA')
                    };

                    products.push(product);
                    
                    // إرسال تأكيد
                    let confirmationMessage = `✅ <b>تم إضافة المنتج بنجاح!</b>\n\n`;
                    confirmationMessage += `📦 <b>الاسم:</b> ${product.name}\n`;
                    confirmationMessage += `💰 <b>السعر:</b> ${product.price} دينار\n`;
                    confirmationMessage += `📄 <b>الوصف:</b> ${product.description}\n`;
                    if (product.image) {
                        confirmationMessage += `🖼️ <b>الصورة:</b> ${product.image}`;
                    } else {
                        confirmationMessage += `🖼️ <b>الصورة:</b> بدون صورة`;
                    }

                    await sendMessage(chatId, confirmationMessage);
                    
                    // مسح حالة المستخدم
                    delete userStates[chatId];
                    break;
            }
            
            return res.send('OK');
        }

        // الأمر /start
        if (text === '/start') {
            await sendMessage(chatId, 
                '🎯 <b>مرحباً! بوت مكتبة الفرزدق</b>\n\n' +
                '👑 أنت مشرف في النظام\n' +
                '/help للمساعدة'
            );
        }

        // الأمر /help
        else if (text === '/help') {
            await sendMessage(chatId, 
                '🧾 <b>الأوامر المتاحة:</b>\n\n' +
                '🛍️ <b>إدارة المنتجات:</b>\n' +
                '/addproduct - إضافة منتج جديد\n' +
                '/listproducts - عرض المنتجات\n' +
                '/deleteproduct اسم_المنتج - حذف منتج\n' +
                '/stats - الإحصائيات\n\n' +
                '👥 <b>إدارة المشرفين:</b>\n' +
                '/addadmin رقم_المشرف\n' +
                '/listadmins\n' +
                '/removeadmin رقم_المشرف\n\n' +
                '/help - المساعدة'
            );
        }

        // الأمر /addproduct
        else if (text === '/addproduct') {
            startAddProduct(chatId);
        }

        // الأمر /addadmin - إضافة مشرف جديد
        else if (text.startsWith('/addadmin')) {
            const newAdminId = text.replace('/addadmin', '').trim();
            
            if (!newAdminId) {
                await sendMessage(chatId, '⚠️ استخدم: /addadmin رقم_المشرف\n\nمثال: /addadmin 123456789');
                return res.send('OK');
            }

            // التحقق إذا الرقم موجود مسبقاً
            if (admins.includes(newAdminId)) {
                await sendMessage(chatId, `❌ الرقم ${newAdminId} مشرف مسبقاً`);
                return res.send('OK');
            }

            // إضافة المشرف الجديد
            admins.push(newAdminId);
            await sendMessage(chatId, `✅ تم إضافة المشرف الجديد:\n👤 الرقم: ${newAdminId}\n\nعدد المشرفين الآن: ${admins.length}`);
        }

        // الأمر /listadmins - عرض المشرفين
        else if (text === '/listadmins') {
            if (admins.length === 0) {
                await sendMessage(chatId, '👥 لا يوجد مشرفين');
                return res.send('OK');
            }

            let message = '👥 <b>قائمة المشرفين:</b>\n\n';
            admins.forEach((adminId, index) => {
                const isYou = adminId === userId ? ' (أنت)' : '';
                message += `${index + 1}. ${adminId}${isYou}\n`;
            });

            await sendMessage(chatId, message);
        }

        // الأمر /removeadmin - إزالة مشرف
        else if (text.startsWith('/removeadmin')) {
            const adminToRemove = text.replace('/removeadmin', '').trim();
            
            if (!adminToRemove) {
                await sendMessage(chatId, '⚠️ استخدم: /removeadmin رقم_المشرف');
                return res.send('OK');
            }

            // منع حذف نفسه
            if (adminToRemove === userId) {
                await sendMessage(chatId, '❌ لا يمكنك حذف نفسك');
                return res.send('OK');
            }

            // البحث والحذف
            const index = admins.indexOf(adminToRemove);
            if (index === -1) {
                await sendMessage(chatId, `❌ الرقم ${adminToRemove} غير موجود في المشرفين`);
                return res.send('OK');
            }

            admins.splice(index, 1);
            await sendMessage(chatId, `✅ تم حذف المشرف:\n👤 الرقم: ${adminToRemove}\n\nعدد المشرفين الآن: ${admins.length}`);
        }

        // الأمر /listproducts
        else if (text === '/listproducts') {
            if (products.length === 0) {
                await sendMessage(chatId, '📦 لا توجد منتجات');
                return res.send('OK');
            }

            let message = '🛍️ <b>المنتجات:</b>\n\n';
            products.forEach((product, index) => {
                message += `${index + 1}. ${product.name} - ${product.price} دينار\n`;
                message += `   📄 ${product.description}\n`;
                if (product.image) {
                    message += `   🖼️ ${product.image}\n`;
                }
                message += '\n';
            });

            await sendMessage(chatId, message);
        }

        // الأمر /deleteproduct - حذف منتج
        else if (text.startsWith('/deleteproduct')) {
            const productName = text.replace('/deleteproduct', '').trim();
            
            if (!productName) {
                await sendMessage(chatId, '⚠️ استخدم: /deleteproduct اسم_المنتج');
                return res.send('OK');
            }

            const productIndex = products.findIndex(p => p.name === productName);
            if (productIndex === -1) {
                await sendMessage(chatId, `❌ المنتج "${productName}" غير موجود`);
                return res.send('OK');
            }

            const deletedProduct = products.splice(productIndex, 1)[0];
            await sendMessage(chatId, 
                `✅ <b>تم حذف المنتج:</b>\n\n` +
                `📦 ${deletedProduct.name}\n` +
                `💰 ${deletedProduct.price} دينار\n` +
                `📄 ${deletedProduct.description}`
            );
        }

        // الأمر /stats
        else if (text === '/stats') {
            const totalProducts = products.length;
            const totalAdmins = admins.length;
            
            await sendMessage(chatId, 
                `📊 <b>الإحصائيات:</b>\n\n` +
                `🛍️ عدد المنتجات: ${totalProducts}\n` +
                `👥 عدد المشرفين: ${totalAdmins}\n` +
                `🏪 النظام يعمل بكفاءة ✅`
            );
        }

        else {
            await sendMessage(chatId, '❌ أمر غير معروف\n/help للمساعدة');
        }

    } catch (error) {
        console.error('❌ خطأ:', error);
    }

    res.send('OK');
});

// صفحة الرئيسية
app.get('/', (req, res) => {
    res.send('🚀 سيرفر مكتبة الفرزدق شغال!');
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ السيرفر شغال على البورت ${PORT}`);
    console.log(`👥 عدد المشرفين: ${admins.length}`);
    console.log(`🛍️ عدد المنتجات: ${products.length}`);
});
