require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running safely!');
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

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

// --- ၁။ စာရိုက်၍ခေါ်သော (Inline Bot / via bot) များကို ချက်ချင်းဖျက်ခြင်း ---
bot.use(async (ctx, next) => {
    if (ctx.message && ctx.message.via_bot) {
        try {
            const member = await ctx.getChatMember(ctx.from.id);
            if (member.status === 'creator' || member.status === 'administrator' || ADMIN_IDS.includes(ctx.from.id)) {
                return next(); // Admin ခေါ်လျှင် ခွင့်ပြုမည်
            }
        } catch (e) {}

        try {
            await ctx.deleteMessage();
            return; // Admin မဟုတ်ဘဲ Bot ခေါ်သုံးလျှင် ချက်ချင်းဖျက်ပြီး ရပ်မည်
        } catch (err) {
            console.log('Error deleting via_bot message:', err);
        }
    }
    return next();
});

// --- ၂။ /ban Command (အပြီးထုတ်ရန်) ---
bot.command('ban', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!ctx.message.reply_to_message) return ctx.reply('💡 Ban လုပ်လိုသူ၏ မက်ဆေ့ခ်ျကို Reply ဆွဲပြီး /ban ဟု ရိုက်ထည့်ပါ။');

    const commanderId = ctx.from.id;
    const replyMsg = ctx.message.reply_to_message;
    if (replyMsg.sender_chat) return ctx.reply('🚫 Channel မက်ဆေ့ခ်ျကို Ban ၍မရပါ။');

    const targetUser = replyMsg.from;
    const targetId = targetUser.id;

    try {
        const commanderMember = await ctx.getChatMember(commanderId);
        if (commanderMember.status !== 'creator' && commanderMember.status !== 'administrator' && !ADMIN_IDS.includes(commanderId)) {
            return ctx.reply('🚫 သင်သည် Admin မဟုတ်ပါ။');
        }

        const targetMember = await ctx.getChatMember(targetId).catch(() => null);
        if (targetMember && (targetMember.status === 'creator' || targetMember.status === 'administrator' || ADMIN_IDS.includes(targetId))) {
            return ctx.reply('🚫 Admin အချင်းချင်း Ban ၍ မရပါ။');
        }

        await ctx.banChatMember(targetId);
        await ctx.deleteMessage(replyMsg.message_id).catch(() => {});
        await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
        await ctx.reply(`✅ [ ${targetUser.first_name} ] ကို Group မှ အောင်မြင်စွာ ဖယ်ရှားလိုက်ပါပြီ။`);
    } catch (err) {
        console.log('Error in /ban:', err);
        ctx.reply('🚫 Ban လုပ်၍မရပါ။ Bot တွင် Ban Users Permission ရှိမရှိ စစ်ဆေးပါ။');
    }
});

// --- ၃။ /mute Command (၂၄ နာရီ စာပို့ခွင့်ပိတ်ရန်) ---
bot.command('mute', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!ctx.message.reply_to_message) return ctx.reply('💡 Mute လုပ်လိုသူ၏ မက်ဆေ့ခ်ျကို Reply ဆွဲပြီး /mute ဟု ရိုက်ထည့်ပါ။');

    const commanderId = ctx.from.id;
    const replyMsg = ctx.message.reply_to_message;
    if (replyMsg.sender_chat) return ctx.reply('🚫 Channel မက်ဆေ့ခ်ျကို Mute ၍မရပါ။');

    const targetUser = replyMsg.from;
    const targetId = targetUser.id;

    try {
        const commanderMember = await ctx.getChatMember(commanderId);
        if (commanderMember.status !== 'creator' && commanderMember.status !== 'administrator' && !ADMIN_IDS.includes(commanderId)) {
            return ctx.reply('🚫 သင်သည် Admin မဟုတ်ပါ။');
        }

        const targetMember = await ctx.getChatMember(targetId).catch(() => null);
        if (targetMember && (targetMember.status === 'creator' || targetMember.status === 'administrator' || ADMIN_IDS.includes(targetId))) {
            return ctx.reply('🚫 Admin အချင်းချင်း Mute ၍ မရပါ။');
        }

        const untilDate = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
        await ctx.restrictChatMember(targetId, {
            permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false, can_add_web_page_previews: false },
            until_date: untilDate
        });
        await ctx.deleteMessage(replyMsg.message_id).catch(() => {});
        await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
        await ctx.reply(`🤐 [ ${targetUser.first_name} ] ကို ၂၄ နာရီ စာပို့ခွင့် ပိတ်လိုက်ပါပြီ။`);
    } catch (err) {
        console.log('Error in /mute:', err);
        ctx.reply('🚫 Mute လုပ်၍မရပါ။ Bot တွင် Restrict Users Permission ရှိမရှိ စစ်ဆေးပါ။');
    }
});

// --- ၄။ /unmute Command (စာပို့ခွင့်ပြန်ပေးရန်) ---
bot.command('unmute', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!ctx.message.reply_to_message) return ctx.reply('💡 Unmute လုပ်လိုသူ၏ မက်ဆေ့ခ်ျကို Reply ဆွဲပြီး /unmute ဟု ရိုက်ထည့်ပါ။');

    const commanderId = ctx.from.id;
    const replyMsg = ctx.message.reply_to_message;
    if (replyMsg.sender_chat) return ctx.reply('🚫 Channel မက်ဆေ့ခ်ျကို Unmute ၍မရပါ။');

    const targetUser = replyMsg.from;
    const targetId = targetUser.id;

    try {
        const commanderMember = await ctx.getChatMember(commanderId);
        if (commanderMember.status !== 'creator' && commanderMember.status !== 'administrator' && !ADMIN_IDS.includes(commanderId)) {
            return ctx.reply('🚫 သင်သည် Admin မဟုတ်ပါ။');
        }

        await ctx.restrictChatMember(targetId, {
            permissions: {
                can_send_messages: true,
                can_send_media_messages: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true
            }
        });

        await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
        await ctx.reply(`🔓 [ ${targetUser.first_name} ] ကို စာပို့ခွင့် ပြန်လည်ပေးအပ်လိုက်ပါပြီ။`);
    } catch (err) {
        console.log('Error in /unmute:', err);
        ctx.reply('🚫 Unmute လုပ်ရာတွင် အမှားအယွင်းရှိပါသည်။');
    }
});
// --- /price Commands (ATF, GRAM, MGRMGA, SLPY ဈေးနှုန်းများကြည့်ရန် - Admin Only) ---
const tokenConfigs = {
    'priceatf': { name: 'ATF', address: 'EQANcW45W0Tp91bzvHayaPO6-6hf1Lm4XlWZ4rN6L5ofPWdb' },
    'pricegram': { name: 'GRAM', address: 'EQC47093oX5XhbLqYA7V_1LpI_2E-rB10s-v-7fXm_u8B7-x' },
    'pricemgrmga': { name: 'MGRMGA', address: 'EQDnthM6DjZLIlQ_lQlCwtj-Ez2UrYzpWUV493bcccz-Rj0c' },
    'priceslpy': { name: 'SLPY', address: 'EQA-mXHQ6mjXr8avmEwSszgeCxAez3uMAwFX1XI1Z4z9VDVp' }
};

Object.keys(tokenConfigs).forEach(cmd => {
    bot.command(cmd, async (ctx) => {
        const userId = ctx.from.id;
        
        // Admin ဟုတ်မဟုတ် စစ်ဆေးခြင်း
        let isAdmin = ADMIN_IDS.includes(userId);
        if (!isAdmin && ctx.chat.type !== 'private') {
            try {
                const member = await ctx.getChatMember(userId);
                if (member.status === 'creator' || member.status === 'administrator') {
                    isAdmin = true;
                }
            } catch (e) {
                console.log('Error checking admin status:', e);
            }
        }

        if (!isAdmin) {
            return ctx.reply('🚫 ဤ Command ကို Admin များသာ အသုံးပြုခွင့် ရှိပါသည်။');
        }

        const tokenInfo = tokenConfigs[cmd];
        const waitingMsg = await ctx.reply(`⏳ ${tokenInfo.name} Token ၏ Live Update ဈေးနှုန်းကို ဆွဲယူနေပါသည်...`);

        try {
            // DexScreener API မှ Live Update ဆွဲယူခြင်း
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenInfo.address}`);
            const data = await response.json();

            if (data.pairs && data.pairs.length > 0) {
                // DeDust သို့မဟုတ် STON.fi မှ အကောင်းဆုံး Pair ကို ရွေးချယ်ခြင်း
                const pair = data.pairs.find(p => p.dexId === 'dedust' || p.dexId === 'ston-fi') || data.pairs[0];
                
                const priceUsd = Number(pair.priceUsd).toPrecision(4);
                const priceTon = Number(pair.priceNative).toPrecision(4);
                const priceChange24h = pair.priceChange.h24;
                const changeEmoji = priceChange24h >= 0 ? '📈' : '📉';

                const priceMessage = `💎 **${tokenInfo.name} Token Price (Live Update)**\n\n` +
                                     `💵 ဈေးနှုန်း (USD): **$${priceUsd}**\n` +
                                     `💠 ဈေးနှုန်း (TON): **${priceTon} TON**\n` +
                                     `${changeEmoji} 24h ပြောင်းလဲမှု: **${priceChange24h}%**\n\n` +
                                     `🔗 [DEX တွင် သွားကြည့်ရန်](${pair.url})`;

                await ctx.telegram.editMessageText(ctx.chat.id, waitingMsg.message_id, null, priceMessage, { 
                    parse_mode: 'Markdown', 
                    disable_web_page_preview: true 
                });
            } else {
                await ctx.telegram.editMessageText(ctx.chat.id, waitingMsg.message_id, null, `❌ ဈေးကွက်ထဲတွင် ${tokenInfo.name} အတွက် ဈေးနှုန်း အချက်အလက် ရှာမတွေ့ပါ။`);
            }
        } catch (err) {
            console.log(`Error fetching ${tokenInfo.name} price:`, err);
            await ctx.telegram.editMessageText(ctx.chat.id, waitingMsg.message_id, null, '🚫 ဈေးနှုန်းဆွဲယူရာတွင် အင်တာနက်ချိတ်ဆက်မှု အမှားအယွင်းဖြစ်ပေါ်နေပါသည်။');
        }
    });
});



// --- ၅။ Message Monitoring (Link, Bad Words & Admin Bypass) ---
bot.on('text', async (ctx) => {
    if (ctx.chat.type === 'private') return;

    const userId = ctx.from.id;
    const userName = ctx.from.first_name;
    const chatId = ctx.chat.id;
    const messageText = ctx.message.text;
    const messageTextLower = messageText.toLowerCase();

    // Admin များကို လုံးဝ ကင်းလွတ်ခွင့်ပေးခြင်း
    if (ADMIN_IDS.includes(userId)) return;
    try {
        const chatMember = await ctx.telegram.getChatMember(chatId, userId);
        if (chatMember.status === 'creator' || chatMember.status === 'administrator') return;
    } catch (e) {}

    // A. Bad Words Check (သတ်မှတ်ထားသော စကားလုံးများနှင့် အတိအကျ ထပ်တူကျမှ စစ်ဆေးရန်)
    const badWords = [
        'လီး', 'ငါလိုး', 'ငါလိုးမ', 'မအေလိုး', 'စောက်ရူး', 'နှမလိုး', 'bitch', 'fuck you', 'fuck',
        'မအေယိုး', 'မအေရိုး', 'ဖာခံ', 'ဖာသည်', 'ဖင်ခံ', 'ငါယိုးမ', 'ငါရိုးမ', 'နှမိုးလ',
        'dick', 'pussy', 'sex', 'ass', 'အီး', 'ချီး', 'သေး', 'လိင်တံ', 'လရည်'
    ];

    const wordsInMessage = messageTextLower.split(/\s+/);
    const containsBadWord = badWords.some(badWord => {
        if (badWord.includes(' ')) {
            return messageTextLower.includes(badWord);
        }
        return wordsInMessage.includes(badWord);
    });

    // B. Link Check
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s]*)/;
    const hasLink = linkRegex.test(messageText);

    // C. Bot Mention Check
    const isBotMention = /@\w+bot\b/i.test(messageText) || messageTextLower.includes('@webbinanceappbot');

    let violationReason = '';
    let silentDelete = false; // တိတ်တဆိတ် ဖျက်ရန် (Warning မပေးပါ)

    if (containsBadWord) {
        violationReason = 'ရိုင်းစိုင်းသော စကားလုံးများ သုံးစွဲခြင်း';
    } else if (isBotMention) {
        violationReason = 'အခြား Bot အမည်များကို ခေါ်ယူအသုံးပြုခြင်း';
    } else if (hasLink) {
        const isTelegramLink = messageText.includes('t.me/') || messageText.includes('telegram.me/');
        if (isTelegramLink) {
            const currentTime = Date.now();

            // ၁။ Bot Link အမည်ကို ထုတ်ယူခြင်း (ဥပမာ - dogetapxbot)
            const botMatch = messageText.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i);
            const botName = botMatch ? botMatch[1].toLowerCase() : '';

            // ၂။ Invite Code / Start Parameter ကို ထုတ်ယူခြင်း
            const paramMatch = messageText.match(/(?:\?start=|\/)([a-zA-Z0-9_-]+)/i);
            const inviteCode = paramMatch ? paramMatch[1] : '';

            // Bot Link ရော Code ရော ရှိမှသာ တူညီမှု ရှိမရှိ စစ်ဆေးမည်
            if (botName && inviteCode) {
                const linkKey = `${chatId}_${userId}_${botName}_${inviteCode}`;

                if (linkShareHistory.has(linkKey)) {
                    const lastShareData = linkShareHistory.get(linkKey);
                    if (currentTime - lastShareData.time < 3600000) { // ၁ နာရီအတွင်း
                        violationReason = 'တူညီသော Bot Link နှင့် Code ကို တစ်နာရီအတွင်း ထပ်မံတင်ခြင်း';
                        silentDelete = true; // သတိပေးချက်မပေးဘဲ ချက်ချင်း တိတ်တဆိတ် ဖျက်မည်
                    } else {
                        linkShareHistory.set(linkKey, { time: currentTime });
                    }
                } else {
                    linkShareHistory.set(linkKey, { time: currentTime });
                }
            }
        } else {
            violationReason = 'ခွင့်မပြုထားသော Link များ တင်ခြင်း';
        }
    }

    if (violationReason) {
        try { await ctx.deleteMessage(); } catch (err) { return; }

        // အကယ်၍ တူညီသော Bot Link နှင့် Code ဖြစ်၍ silentDelete ဖြစ်နေလျှင် ဤနေရာတွင် ရပ်မည် (Warning လုံးဝမပေးပါ)
        if (silentDelete) {
            return;
        }

        let warnings = (userWarnings.get(userId) || 0) + 1;
        userWarnings.set(userId, warnings);

        const punishmentType = warnings === 1 ? 'Warning ပေးရန်' : (warnings === 2 ? '၁၀ မိနစ် Muteရန်' : (warnings === 3 ? '၁ နာရီ Muteရန်' : 'Group မှ Banရန်'));
        const actionId = `punish_${userId}_${Date.now()}`;
        pendingPunishments.set(actionId, { chatId, userId, userName, warnings, timestamp: Date.now() });

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
                console.log(`Admin (ID: ${adminId}) ဆီသို့ မက်ဆေ့ခ်ျပို့၍ မရပါ။`);
            }
        }

        const msg = await ctx.reply(`${userName}၊ သင့်၏ မက်ဆေ့ခ်ျသည် စည်းကမ်းနှင့် မကိုက်ညီသဖြင့် ဖျက်လိုက်ပါပြီ။ Admin ၏ ဆုံးဖြတ်ချက်ကို စောင့်ဆိုင်းနေပါသည်။`);
        setTimeout(() => ctx.telegram.deleteMessage(chatId, msg.message_id).catch(() => {}), 6000);
    }
});

// --- ၆. Admin Decision Handling ---
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    const adminId = ctx.from.id;

    if (!ADMIN_IDS.includes(adminId)) return ctx.answerCbQuery('Admin များသာ လုပ်ဆောင်နိုင်ပါသည်။', { show_alert: true });

    const [action, actionId] = callbackData.split('_', 2);
    const fullActionId = callbackData.replace(`${action}_`, '');

    if (!pendingPunishments.has(fullActionId)) {
        return ctx.answerCbQuery('ဤအချက်အလက် သက်တမ်းကုန်သွားပါပြီ (သို့) လုပ်ဆောင်ပြီးသား ဖြစ်ပါသည်။', { show_alert: true });
    }

    const punishData = pendingPunishments.get(fullActionId);
    
    if (Date.now() - punishData.timestamp > 15 * 60 * 1000) {
        pendingPunishments.delete(fullActionId);
        return ctx.editMessageText('❌ ဤအတည်ပြုချက်သည် ၁၅ မိနစ်ကျော်သွားပြီဖြစ်သောကြောင့် သက်တမ်းကုန်သွားပါပြီ။');
    }

    pendingPunishments.delete(fullActionId);

    if (action === 'approve') {
        try {
            if (punishData.warnings === 1) {
                await ctx.telegram.sendMessage(punishData.chatId, `⚠️ **Warning:** ${punishData.userName}၊ စည်းကမ်းချက်များကို လိုက်နာပေးပါ။`);
            } else if (punishData.warnings === 2) {
                const muteUntil = Math.floor(Date.now() / 1000) + (10 * 60);
                await ctx.telegram.restrictChatMember(punishData.chatId, punishData.userId, {
                    permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false, can_add_web_page_previews: false },
                    until_date: muteUntil
                });
                await ctx.telegram.sendMessage(punishData.chatId, `🔇 **Punishment:** ${punishData.userName} ကို **၁၀ မိနစ်** Mute လိုက်ပါပြီ။`);
            } else if (punishData.warnings === 3) {
                const muteUntil = Math.floor(Date.now() / 1000) + (60 * 60);
                await ctx.telegram.restrictChatMember(punishData.chatId, punishData.userId, {
                    permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false, can_add_web_page_previews: false },
                    until_date: muteUntil
                });
                await ctx.telegram.sendMessage(punishData.chatId, `🔇 **Punishment:** ${punishData.userName} ကို **၁ နာရီ** Mute လိုက်ပါပြီ။`);
            } else {
                await ctx.telegram.banChatMember(punishData.chatId, punishData.userId);
                await ctx.telegram.sendMessage(punishData.chatId, `🚫 **Punishment:** ${punishData.userName} ကို Group မှ ထုတ်ပယ်လိုက်ပါပြီ (Ban)။`);
            }
            await ctx.editMessageText(`✅ အတည်ပြုပြီးပါပြီ။ ${punishData.userName} အပေါ် အပြစ်ပေးမှု ဆောင်ရွက်ပြီးပါပြီ။`);
        } catch (e) {
            await ctx.editMessageText(`🚫 အမှားအယွင်း ရှိသွားပါသည် (Bot တွင် Admin အခွင့်အရေး ရှိမရှိ စစ်ဆေးပါ)။`);
        }
    } else {
        await ctx.editMessageText(`❌ ပယ်ချလိုက်ပါပြီ။ ${punishData.userName} အပေါ် မည်သည့် အပြစ်ပေးမှုမျှ လုပ်ဆောင်မည် မဟုတ်ပါ။`);
    }
    await ctx.answerCbQuery();
});

// --- ၇. Anti-Bot ---
bot.on('new_chat_members', async (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    for (const member of newMembers) {
        if (member.is_bot && member.id !== ctx.botInfo.id) {
            try {
                await ctx.banChatMember(member.id);
                await ctx.reply(`🚫 အခြား Bot အကောင့်များ ဝင်ခွင့်မပြုသောကြောင့် [ ${member.first_name} ] ကို ဖယ်ရှားလိုက်ပါတယ်။`);
            } catch (err) {
                console.log('Bot ကို ဖယ်ရှားရာတွင် Error:', err);
            }
        } else if (!member.is_bot) {
            ctx.reply(`မင်္ဂလာပါ ${member.first_name}၊ Group ထဲကို ကြိုဆိုပါတယ်။ စည်းကမ်းများကို လိုက်နာပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။`);
        }
    }
});

bot.launch();
console.log('Bot is running safely...');
