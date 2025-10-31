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

// دالة إرسال رسالة للتليجرام
async function sendMessage(chatId, text) {
    try {
        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.log('❌ خطأ في الإرسال:', error.message);
    }
}

// دالة التحقق من صلاحية الأدمن
function isAdmin(userId) {
    return admins.includes(userId.toString());
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
                '/addproduct اسم~سعر~تصنيف~وصف~[صورة]\n' +
                '/listproducts\n' +
                '/deleteproduct اسم_المنتج\n' +
                '/stats\n\n' +
                '👥 <b>إدارة المشرفين:</b>\n' +
                '/addadmin رقم_المشرف\n' +
                '/listadmins\n' +
                '/removeadmin رقم_المشرف\n\n' +
                '/help'
            );
        }

        // الأمر /addproduct
        else if (text.startsWith('/addproduct')) {
            const data = text.replace('/addproduct', '').trim();
            
            if (!data.includes('~')) {
                await sendMessage(chatId, '⚠️ استخدم: /addproduct اسم~سعر~تصنيف~وصف~[صورة]');
                return res.send('OK');
            }

            const parts = data.split('~');
            const name = parts[0];
            const price = parts[1];
            const category = parts[2];
            const description = parts[3];
            const image = parts[4];

            // التحقق من التصنيف
            if (!['stationery', 'pens', 'papers'].includes(category)) {
                await sendMessage(chatId, '⚠️ التصنيف غير صالح. المسموح: stationery, pens, papers');
                return res.send('OK');
            }

            // إضافة المنتج
            products.push({
                id: Date.now(),
                name,
                price,
                category,
                description,
                image: image || ''
            });

            await sendMessage(chatId, `✅ تم إضافة المنتج:\n📦 ${name}\n💰 ${price} دينار\n📁 ${category}`);
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
            });

            await sendMessage(chatId, message);
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
