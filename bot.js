require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

// Initialize Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Load Admins from environment variable (converted to array of Numbers)
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()));

// Memory Storage
const userWarnings = new Map();
const linkShareHistory = new Map();
const pendingPunishments = new Map();

bot.start((ctx) => {
    ctx.reply('မင်္ဂလာပါ။ Advanced Admin-Approval Group Moderator Bot အဆင်သင့် ဖြစ်ပါပြီ။');
});

// Message Monitoring
bot.on('text', async (ctx) => {
    if (ctx.chat.type === 'private') return;

    const userId = ctx.from.id;
    const userName = ctx.from.first_name;
    const chatId = ctx.chat.id;
    const messageText = ctx.message.text;
    const messageTextLower = messageText.toLowerCase();

    // Skip check for Admins
    try {
        const chatMember = await ctx.telegram.getChatMember(chatId, userId);
        if (chatMember.status === 'creator' || chatMember.status === 'administrator') return;
    } catch (e) {}

    // A. Bad Words Check
    const badWords = ['လီး', 'ငါလိုး', 'ငါလိုးမ', 'မအေလိုး', 'စောက်ရူး', 'နှမလိုး', 'bitch', 'fuck you', 'fuck'];
    const containsBadWord = badWords.some(word => messageTextLower.includes(word));

    // B. Link Check
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s]*)/;
    const hasLink = linkRegex.test(messageText);

    let violationReason = '';
    if (containsBadWord) {
        violationReason = 'ရိုင်းစိုင်းသော စကားလုံးများ သုံးစွဲခြင်း';
    } else if (hasLink) {
        const isTelegramLink = messageText.includes('t.me/') || messageText.includes('telegram.me/');
        if (isTelegramLink) {
            const currentTime = Date.now();
            const linkKey = `${chatId}_${messageText}`;
            if (linkShareHistory.has(linkKey)) {
                const lastShareData = linkShareHistory.get(linkKey);
                if (currentTime - lastShareData.time < 3600000) { // 1 Hour
                    violationReason = 'Telegram Link ကို တစ်နာရီအတွင်း ထပ်ခါထပ်ခါ တင်ခြင်း';
                } else {
                    linkShareHistory.set(linkKey, { userId, time: currentTime });
                }
            } else {
                linkShareHistory.set(linkKey, { userId, time: currentTime });
            }
        } else {
            violationReason = 'ခွင့်မပြုထားသော Link များ တင်ခြင်း';
        }
    }

    if (violationReason) {
        try { await ctx.deleteMessage(); } catch (err) { return; }

        let warnings = (userWarnings.get(userId) || 0) + 1;
        userWarnings.set(userId, warnings);

        const punishmentType = warnings === 1 ? 'Warning ပေးရန်' : (warnings === 2 ? '၁၀ မိနစ် Muteရန်' : (warnings === 3 ? '၁ နာရီ Muteရန်' : 'Group မှ Banရန်'));
        const actionId = `punish_${userId}_${Date.now()}`;
        pendingPunishments.set(actionId, { chatId, userId, userName, warnings });

       for (const adminId of ADMIN_IDS) {
    try {
        await ctx.telegram.sendMessage(
            adminId,
            `🚨 **စည်းကမ်းဖောက်ဖျက်မှု အတည်ပြုရန်**\n\n- အသုံးပြုသူ: ${userName} (ID: ${userId})\n- အကြောင်းရင်း: ${violationReason}\n- ချိုးဖောက်မှုအကြိမ်ရေ: ${warnings} ကြိမ်\n- အကြံပြုအရေးယူမှု: **${punishmentType}**\n- မူရင်းစာသား: "${messageText}"`,
            {
                
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('✅ အတည်ပြုမည် (Approve)', `approve_${actionId}`)],
                    [Markup.button.callback('❌ ပယ်ချမည် (Reject)', `reject_${actionId}`)]
                ])
            }
        );
    } catch (e) {
        console.log(`Admin (ID: ${adminId}) ဆီသို့ မက်ဆေ့ခ်ျပို့၍ မရပါ။ အကြောင်းရင်း:`, e.message);
    }
}

        const msg = await ctx.reply(`${userName}၊ သင့်၏ မက်ဆေ့ခ်ျသည် စည်းကမ်းနှင့် မကိုက်ညီသဖြင့် ဖျက်လိုက်ပါပြီ။ Admin ၏ ဆုံးဖြတ်ချက်ကို စောင့်ဆိုင်းနေပါသည်။`);
        setTimeout(() => ctx.telegram.deleteMessage(chatId, msg.message_id).catch(() => {}), 6000);
    }
});

// Admin Decision Handling
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    const adminId = ctx.from.id;

    if (!ADMIN_IDS.includes(adminId)) return ctx.answerCbQuery('Admin များသာ လုပ်ဆောင်နိုင်ပါသည်။', { show_alert: true });

    const [action, actionId] = callbackData.split('_', 2);
    const fullActionId = callbackData.replace(`${action}_`, '');

    if (!pendingPunishments.has(fullActionId)) return ctx.answerCbQuery('ဤအချက်အလက် သက်တမ်းကုန်သွားပါပြီ။');

    const punishData = pendingPunishments.get(fullActionId);
    pendingPunishments.delete(fullActionId);

    if (action === 'approve') {
        try {
            if (punishData.warnings === 1) {
                await ctx.telegram.sendMessage(punishData.chatId, `**Warning:** ${punishData.userName}၊ စည်းကမ်းချက်များကို လိုက်နာပေးပါ။`);
            } else if (punishData.warnings === 2) {
                await ctx.telegram.restrictChatMember(punishData.chatId, punishData.userId, { permissions: { can_send_messages: false } });
                await ctx.telegram.sendMessage(punishData.chatId, `**Punishment:** ${punishData.userName} ကို **၁၀ မိနစ်** Mute လိုက်ပါပြီ။`);
            } else if (punishData.warnings === 3) {
                await ctx.telegram.restrictChatMember(punishData.chatId, punishData.userId, { permissions: { can_send_messages: false } });
                await ctx.telegram.sendMessage(punishData.chatId, `**Punishment:** ${punishData.userName} ကို **၁ နာရီ** Mute လိုက်ပါပြီ။`);
            } else {
                await ctx.telegram.banChatMember(punishData.chatId, punishData.userId);
                await ctx.telegram.sendMessage(punishData.chatId, `**Punishment:** ${punishData.userName} ကို Group မှ ထုတ်ပယ်လိုက်ပါပြီ (Ban)။`);
            }
            await ctx.editMessageText(`အတည်ပြုပြီးပါပြီ။ ${punishData.userName} အပေါ် အပြစ်ပေးမှု ဆောင်ရွက်ပြီးပါပြီ။`);
        } catch (e) {
            await ctx.editMessageText(`အမှားအယွင်း ရှိသွားပါသည် (Bot တွင် Admin အခွင့်အရေး ရှိမရှိ စစ်ဆေးပါ)။`);
        }
    } else {
        await ctx.editMessageText(`ပယ်ချလိုက်ပါပြီ။ ${punishData.userName} အပေါ် မည်သည့် အပြစ်ပေးမှုမျှ လုပ်ဆောင်မည် မဟုတ်ပါ။`);
    }
    await ctx.answerCbQuery();
});

bot.on('new_chat_members', (ctx) => {
    ctx.message.new_chat_members.forEach((member) => {
        ctx.reply(`မင်္ဂလာပါ ${member.first_name}၊ Group ထဲကို ကြိုဆိုပါတယ်။ စည်းကမ်းများကို လိုက်နာပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။`);
    });
});

bot.launch();
console.log('Bot is running safely...');