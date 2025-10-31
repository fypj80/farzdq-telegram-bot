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

// تخزين حالة المستخدمين
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

// دالة إرسال صورة
async function sendPhoto(chatId, photoUrl, caption = '', replyMarkup = null) {
    try {
        const payload = {
            chat_id: chatId,
            photo: photoUrl,
            caption: caption,
            parse_mode: 'HTML'
        };

        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }

        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, payload);
    } catch (error) {
        console.log('❌ خطأ في إرسال الصورة:', error.message);
    }
}

// دالة التحقق من صلاحية الأدمن
function isAdmin(userId) {
    return admins.includes(userId.toString());
}

// الكيبورد الرئيسي
function getMainKeyboard() {
    return {
        keyboard: [
            [{ text: '🛍️ المنتجات' }, { text: '👥 المشرفين' }],
            [{ text: 'ℹ️ المساعدة' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

// كيبورد قسم المنتجات
function getProductsKeyboard() {
    return {
        keyboard: [
            [{ text: '📦 إضافة منتج' }, { text: '🗑️ حذف منتج' }],
            [{ text: '📋 قائمة المنتجات' }, { text: '📊 الإحصائيات' }],
            [{ text: '🔙 رجوع' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

// كيبورد قسم المشرفين
function getAdminsKeyboard() {
    return {
        keyboard: [
            [{ text: '➕ إضافة مشرف' }, { text: '➖ حذف مشرف' }],
            [{ text: '📋 قائمة المشرفين' }],
            [{ text: '🔙 رجوع' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

// كيبورد الإلغاء
function getCancelKeyboard() {
    return {
        keyboard: [[{ text: '❌ إلغاء' }]],
        resize_keyboard: true,
        one_time_keyboard: true
    };
}

// كيبورد الصور
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

// كيبورد حذف المنتجات
function getDeleteProductsKeyboard(products) {
    const keyboard = [];
    
    for (let i = 0; i < products.length; i += 3) {
        const row = [];
        for (let j = i; j < i + 3 && j < products.length; j++) {
            row.push({ text: `${j + 1}️⃣` });
        }
        keyboard.push(row);
    }
    
    keyboard.push([{ text: '🔙 رجوع' }]);
    
    return {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

// كيبورد حذف المشرفين
function getDeleteAdminsKeyboard(adminsList, currentUserId) {
    const keyboard = [];
    
    for (let i = 0; i < adminsList.length; i += 2) {
        const row = [];
        for (let j = i; j < i + 2 && j < adminsList.length; j++) {
            const admin = adminsList[j];
            const isYou = admin === currentUserId ? ' (أنت)' : '';
            row.push({ text: `${j + 1}️⃣ ${admin}${isYou}` });
        }
        keyboard.push(row);
    }
    
    keyboard.push([{ text: '🔙 رجوع' }]);
    
    return {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

// بدء إضافة منتج
function startAddProduct(chatId) {
    userStates[chatId] = {
        state: 'awaiting_product_name',
        productData: {},
        section: 'products'
    };
    sendMessage(chatId, '📝 <b>أدخل اسم المنتج:</b>', getCancelKeyboard());
}

// بدء حذف منتج
function startDeleteProduct(chatId) {
    if (products.length === 0) {
        sendMessage(chatId, '📦 <b>لا توجد منتجات للحذف</b>', getProductsKeyboard());
        return;
    }

    userStates[chatId] = {
        state: 'awaiting_delete_product',
        section: 'products'
    };

    let message = '🗑️ <b>اختر المنتج للحذف:</b>\n\n';
    products.forEach((product, index) => {
        message += `${index + 1}️⃣ ${product.name} - ${product.price} دينار\n`;
    });

    sendMessage(chatId, message, getDeleteProductsKeyboard(products));
}

// بدء إضافة مشرف
function startAddAdmin(chatId) {
    userStates[chatId] = {
        state: 'awaiting_admin_id',
        section: 'admins'
    };
    sendMessage(chatId, '👤 <b>أدخل آيدي المشرف الجديد:</b>\n\nمثال: 123456789', getCancelKeyboard());
}

// بدء حذف مشرف
function startDeleteAdmin(chatId, userId) {
    if (admins.length <= 1) {
        sendMessage(chatId, '👥 <b>لا يمكن حذف المشرفين، يجب أن يبقى مشرف واحد على الأقل</b>', getAdminsKeyboard());
        return;
    }

    userStates[chatId] = {
        state: 'awaiting_delete_admin',
        section: 'admins'
    };

    let message = '🗑️ <b>اختر المشرف للحذف:</b>\n\n';
    admins.forEach((adminId, index) => {
        const isYou = adminId === userId ? ' (أنت)' : '';
        message += `${index + 1}️⃣ ${adminId}${isYou}\n`;
    });

    sendMessage(chatId, message, getDeleteAdminsKeyboard(admins, userId));
}

// المساعدة الذكية
async function handleHelp(chatId, userMessage = '') {
    if (userMessage) {
        // محاكاة الذكاء الاصطناعي - يمكنك إضافة API حقيقي هنا
        const responses = {
            'اضافة منتج': 'لإضافة منتج:\n1. اذهب لقسم 🛍️ المنتجات\n2. اختر 📦 إضافة منتج\n3. اتبع الخطوات',
            'حذف منتج': 'لحذف منتج:\n1. اذهب لقسم 🛍️ المنتجات\n2. اختر 🗑️ حذف منتج\n3. اختر المنتج من القائمة',
            'اضافة مشرف': 'لإضافة مشرف:\n1. اذهب لقسم 👥 المشرفين\n2. اختر ➕ إضافة مشرف\n3. أدخل الآيدي',
            'حذف مشرف': 'لحذف مشرف:\n1. اذهب لقسم 👥 المشرفين\n2. اختر ➖ حذف مشرف\n3. اختر من القائمة',
            'مشكلة': 'إذا واجهتك مشكلة:\n• تأكد من اتصال الإنترنت\n• جرب إعادة تشغيل البوت\n• تأكد من أنك مشرف'
        };

        const lowerMessage = userMessage.toLowerCase();
        let response = '🤖 <b>المساعدة الذكية:</b>\n\n';

        for (const [key, value] of Object.entries(responses)) {
            if (lowerMessage.includes(key)) {
                response += value;
                break;
            }
        }

        if (response === '🤖 <b>المساعدة الذكية:</b>\n\n') {
            response += '💡 <b>كيف يمكنني مساعدتك؟</b>\n\n';
            response += '• اكتب "اضافة منتج" للمساعدة في إضافة المنتجات\n';
            response += '• اكتب "حذف منتج" للمساعدة في حذف المنتجات\n';
            response += '• اكتب "اضافة مشرف" للمساعدة في إضافة المشرفين\n';
            response += '• اكتب "حذف مشرف" للمساعدة في حذف المشرفين\n';
            response += '• اكتب "مشكلة" للمساعدة في حل المشاكل';
        }

        await sendMessage(chatId, response, getMainKeyboard());
    } else {
        await sendMessage(chatId, 
            'ℹ️ <b>قسم المساعدة الذكية</b>\n\n' +
            '💡 <b>اطرح سؤالك وسأحاول مساعدتك:</b>\n\n' +
            '• كيفية إضافة منتج؟\n' +
            '• كيفية حذف منتج؟\n' +
            '• كيفية إدارة المشرفين؟\n' +
            '• حلول للمشاكل التقنية\n\n' +
            '📝 <b>اكتب سؤالك الآن...</b>',
            {
                keyboard: [[{ text: '🔙 رجوع' }]],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        );
    }
}

// استقبال رسائل التليجرام
app.post('/webhook', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.send('OK');
        
        const chatId = message.chat.id;
        const userId = message.from.id.toString();
        const text = message.text || '';

        console.log(`📱 رسالة من ${userId}: ${text}`);

        // التحقق من المسؤول
        if (!isAdmin(userId)) {
            await sendMessage(chatId, '❌ ليس لديك صلاحية للتحكم');
            return res.send('OK');
        }

        // معالجة الصور المرفوعة
        if (message.photo && userStates[chatId] && userStates[chatId].state === 'awaiting_product_image') {
            const photo = message.photo[message.photo.length - 1];
            const fileId = photo.file_id;
            
            userStates[chatId].productData.image = fileId;
            
            // حفظ المنتج
            const productData = userStates[chatId].productData;
            const product = {
                id: Date.now(),
                name: productData.name,
                price: productData.price,
                description: productData.description,
                image: fileId,
                date: new Date().toLocaleDateString('ar-SA')
            };

            products.push(product);
            
            let confirmationMessage = `✅ <b>تم إضافة المنتج بنجاح!</b>\n\n`;
            confirmationMessage += `📦 <b>الاسم:</b> ${product.name}\n`;
            confirmationMessage += `💰 <b>السعر:</b> ${product.price} دينار\n`;
            confirmationMessage += `📄 <b>الوصف:</b> ${product.description}\n`;
            confirmationMessage += `🖼️ <b>الصورة:</b> مرفقة`;

            await sendMessage(chatId, confirmationMessage, getProductsKeyboard());
            delete userStates[chatId];
            return res.send('OK');
        }

        // الأزرار الرئيسية
        if (text === '🔙 رجوع') {
            delete userStates[chatId];
            await sendMessage(chatId, '🏠 <b>القائمة الرئيسية</b>', getMainKeyboard());
            return res.send('OK');
        }

        if (text === '🛍️ المنتجات') {
            await sendMessage(chatId, '📁 <b>قسم إدارة المنتجات</b>', getProductsKeyboard());
            return res.send('OK');
        }

        if (text === '👥 المشرفين') {
            await sendMessage(chatId, '📁 <b>قسم إدارة المشرفين</b>', getAdminsKeyboard());
            return res.send('OK');
        }

        if (text === 'ℹ️ المساعدة') {
            await handleHelp(chatId);
            return res.send('OK');
        }

        // قسم المنتجات
        if (text === '📦 إضافة منتج') {
            startAddProduct(chatId);
            return res.send('OK');
        }

        if (text === '🗑️ حذف منتج') {
            startDeleteProduct(chatId);
            return res.send('OK');
        }

        if (text === '📋 قائمة المنتجات') {
            if (products.length === 0) {
                await sendMessage(chatId, '📦 <b>لا توجد منتجات</b>', getProductsKeyboard());
                return res.send('OK');
            }

            let message = '🛍️ <b>قائمة المنتجات:</b>\n\n';
            products.forEach((product, index) => {
                message += `${index + 1}️⃣ <b>${product.name}</b>\n`;
                message += `💰 ${product.price} دينار\n`;
                message += `📄 ${product.description}\n`;
                if (product.image) {
                    message += `🖼️ لديه صورة\n`;
                }
                message += '\n';
            });

            await sendMessage(chatId, message, getProductsKeyboard());
            return res.send('OK');
        }

        if (text === '📊 الإحصائيات') {
            const totalProducts = products.length;
            const totalAdmins = admins.length;
            
            await sendMessage(chatId, 
                `📊 <b>الإحصائيات:</b>\n\n` +
                `🛍️ عدد المنتجات: ${totalProducts}\n` +
                `👥 عدد المشرفين: ${totalAdmins}\n` +
                `🏪 النظام يعمل بكفاءة ✅`,
                getProductsKeyboard()
            );
            return res.send('OK');
        }

        // قسم المشرفين
        if (text === '➕ إضافة مشرف') {
            startAddAdmin(chatId);
            return res.send('OK');
        }

        if (text === '➖ حذف مشرف') {
            startDeleteAdmin(chatId, userId);
            return res.send('OK');
        }

        if (text === '📋 قائمة المشرفين') {
            if (admins.length === 0) {
                await sendMessage(chatId, '👥 <b>لا يوجد مشرفين</b>', getAdminsKeyboard());
                return res.send('OK');
            }

            let message = '👥 <b>قائمة المشرفين:</b>\n\n';
            admins.forEach((adminId, index) => {
                const isYou = adminId === userId ? ' (أنت)' : '';
                message += `${index + 1}️⃣ ${adminId}${isYou}\n`;
            });

            await sendMessage(chatId, message, getAdminsKeyboard());
            return res.send('OK');
        }

        // معالجة الحالات النشطة
        if (userStates[chatId]) {
            const userState = userStates[chatId];
            
            if (text === '❌ إلغاء') {
                delete userStates[chatId];
                if (userState.section === 'products') {
                    await sendMessage(chatId, '❌ <b>تم الإلغاء</b>', getProductsKeyboard());
                } else if (userState.section === 'admins') {
                    await sendMessage(chatId, '❌ <b>تم الإلغاء</b>', getAdminsKeyboard());
                }
                return res.send('OK');
            }

            // معالجة إضافة المنتج
            if (userState.state === 'awaiting_product_name') {
                userState.productData.name = text;
                userState.state = 'awaiting_product_price';
                await sendMessage(chatId, '💰 <b>أدخل سعر المنتج:</b>\n\nمثال: 15000', getCancelKeyboard());
            }
            else if (userState.state === 'awaiting_product_price') {
                const price = parseFloat(text);
                if (isNaN(price)) {
                    await sendMessage(chatId, '⚠️ <b>يرجى إدخال سعر صحيح!</b>\n\nمثال: 15000', getCancelKeyboard());
                    return;
                }
                userState.productData.price = price;
                userState.state = 'awaiting_product_description';
                await sendMessage(chatId, '📄 <b>أدخل وصف المنتج:</b>', getCancelKeyboard());
            }
            else if (userState.state === 'awaiting_product_description') {
                userState.productData.description = text;
                userState.state = 'awaiting_product_image';
                await sendMessage(chatId, 
                    '🖼️ <b>أرسل صورة المنتج:</b>\n\n' +
                    '• اضغط ⏩ تخطي إذا لم ترد إضافة صورة\n' +
                    '• أو قم بإرسال الصورة مباشرة', 
                    getImageKeyboard()
                );
            }
            else if (userState.state === 'awaiting_product_image') {
                if (text === '⏩ تخطي') {
                    userState.productData.image = '';
                    const product = {
                        id: Date.now(),
                        name: userState.productData.name,
                        price: userState.productData.price,
                        description: userState.productData.description,
                        image: '',
                        date: new Date().toLocaleDateString('ar-SA')
                    };

                    products.push(product);
                    
                    let confirmationMessage = `✅ <b>تم إضافة المنتج بنجاح!</b>\n\n`;
                    confirmationMessage += `📦 <b>الاسم:</b> ${product.name}\n`;
                    confirmationMessage += `💰 <b>السعر:</b> ${product.price} دينار\n`;
                    confirmationMessage += `📄 <b>الوصف:</b> ${product.description}\n`;
                    confirmationMessage += `🖼️ <b>الصورة:</b> بدون صورة`;

                    await sendMessage(chatId, confirmationMessage, getProductsKeyboard());
                    delete userStates[chatId];
                }
            }
            // معالجة إضافة المشرف
            else if (userState.state === 'awaiting_admin_id') {
                const newAdminId = text.trim();
                
                if (!newAdminId || isNaN(newAdminId)) {
                    await sendMessage(chatId, '⚠️ <b>يرجى إدخال آيدي صحيح!</b>\n\nمثال: 123456789', getCancelKeyboard());
                    return;
                }

                if (admins.includes(newAdminId)) {
                    await sendMessage(chatId, `❌ الرقم ${newAdminId} مشرف مسبقاً`, getAdminsKeyboard());
                } else {
                    admins.push(newAdminId);
                    await sendMessage(chatId, 
                        `✅ <b>تم إضافة المشرف بنجاح!</b>\n\n` +
                        `👤 <b>الآيدي:</b> ${newAdminId}\n` +
                        `📊 <b>عدد المشرفين الآن:</b> ${admins.length}`,
                        getAdminsKeyboard()
                    );
                }
                delete userStates[chatId];
            }
            // معالجة حذف المنتج
            else if (userState.state === 'awaiting_delete_product') {
                const match = text.match(/^(\d+)️⃣$/);
                if (match) {
                    const productIndex = parseInt(match[1]) - 1;
                    
                    if (productIndex >= 0 && productIndex < products.length) {
                        const deletedProduct = products.splice(productIndex, 1)[0];
                        delete userStates[chatId];
                        
                        await sendMessage(chatId, 
                            `✅ <b>تم حذف المنتج بنجاح!</b>\n\n` +
                            `📦 <b>الاسم:</b> ${deletedProduct.name}\n` +
                            `💰 <b>السعر:</b> ${deletedProduct.price} دينار\n` +
                            `📄 <b>الوصف:</b> ${deletedProduct.description}`,
                            getProductsKeyboard()
                        );
                    } else {
                        await sendMessage(chatId, '❌ <b>رقم غير صحيح</b>', getDeleteProductsKeyboard(products));
                    }
                }
            }
            // معالجة حذف المشرف
            else if (userState.state === 'awaiting_delete_admin') {
                const match = text.match(/^(\d+)️⃣/);
                if (match) {
                    const adminIndex = parseInt(match[1]) - 1;
                    
                    if (adminIndex >= 0 && adminIndex < admins.length) {
                        const adminToRemove = admins[adminIndex];
                        
                        if (adminToRemove === userId) {
                            await sendMessage(chatId, '❌ <b>لا يمكنك حذف نفسك</b>', getDeleteAdminsKeyboard(admins, userId));
                            return;
                        }

                        if (admins.length <= 1) {
                            await sendMessage(chatId, '❌ <b>لا يمكن حذف آخر مشرف</b>', getAdminsKeyboard());
                            return;
                        }

                        admins.splice(adminIndex, 1);
                        delete userStates[chatId];
                        
                        await sendMessage(chatId, 
                            `✅ <b>تم حذف المشرف بنجاح!</b>\n\n` +
                            `👤 <b>الآيدي:</b> ${adminToRemove}\n` +
                            `📊 <b>عدد المشرفين الآن:</b> ${admins.length}`,
                            getAdminsKeyboard()
                        );
                    } else {
                        await sendMessage(chatId, '❌ <b>رقم غير صحيح</b>', getDeleteAdminsKeyboard(admins, userId));
                    }
                }
            }

            return res.send('OK');
        }

        // المساعدة الذكية
        if (text && !text.startsWith('/')) {
            const helpKeywords = ['مساعدة', 'مساعده', 'help', 'دعم', 'مشكلة', 'problem', 'error'];
            const isHelpRequest = helpKeywords.some(keyword => text.includes(keyword));
            
            if (isHelpRequest || !userStates[chatId]) {
                await handleHelp(chatId, text);
                return res.send('OK');
            }
        }

        // الأمر /start
        if (text === '/start') {
            await sendMessage(chatId, 
                '🎯 <b>مرحباً! بوت مكتبة الفرزدق</b>\n\n' +
                '👑 أنت مشرف في النظام\n' +
                '💡 استخدم الأزرار للتحكم في البوت',
                getMainKeyboard()
            );
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
