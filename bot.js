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
if (!process.env.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is missing in Render Environment Variables');
}
const bot = new Telegraf(process.env.BOT_TOKEN);
// Load Admins from environment variable (converted to array of Numbers)
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(Number.isFinite);
if (ADMIN_IDS.length === 0) {
    console.warn('WARNING: ADMIN_IDS is empty or invalid. Admin-only commands will not work.');
}
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
        if (!ctx.from || String(ctx.from.username || "").toLowerCase() === "sleepypricebot" ||
            ["8628536738", "8628586738"].includes(String(ctx.from.id))) return next();
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
// --- /price Commands (ATF, GRAM, MRG, SLPY, VIC, MAI ဈေးနှုန်းများကြည့်ရန် - Admin Only) ---
const tokenConfigs = {
    atf:  { name: 'ATF',  address: 'EQANcW45W0Tp91bzvHayaPO6-6hf1Lm4XlWZ4rN6L5ofPWdb' },
    gram: { name: 'GRAM', address: 'EQC47093oX5XhbLqYA7V_1LpI_2E-rB10s-v-7fXm_u8B7-x' },
    mrg:  { name: 'MRG',  address: 'EQDj-zlSvj4Au154XjsU7ATzt13p8JjYEs0weVv1rVbCJSn0' },
    slpy: { name: 'SLPY', address: 'EQA-mXHQ6mjXr8avmEwSszgeCxAez3uMAwFX1XI1Z4z9VDVp' },
    vic:  { name: 'VIC',  address: 'EQClb4h8Wnqx-X_sKMFExqxcQusCktlMHxYZ2M80A_WnnFUe' },
    mai:  { name: 'MAI',  address: 'EQD5pWilwl9ypQ1JFxoDktsQl_LAALALnqHjZoxhx_2nET-r' }
};
const PRICE_API_TIMEOUT_MS = 10000;
const PRICE_CACHE_TTL_MS = 30 * 1000;
const PRICE_STALE_TTL_MS = 30 * 60 * 1000;
const priceCache = new Map();
const priceInFlight = new Map();
function httpError(provider, response) {
    const err = new Error(`${provider} HTTP ${response.status} ${response.statusText}`);
    err.status = response.status;
    err.provider = provider;
    return err;
}
async function fetchJson(url, provider) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PRICE_API_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        if (!response.ok) throw httpError(provider, response);
        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}
function selectPreferredPair(pairs) {
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    const tonPairs = pairs.filter(p => p && p.chainId === 'ton');
    const preferred = tonPairs.filter(p => p.dexId === 'dedust' || p.dexId === 'ston-fi');
    const candidates = preferred.length ? preferred : (tonPairs.length ? tonPairs : pairs);
    return [...candidates].sort((a, b) =>
        (Number(b?.liquidity?.usd) || 0) - (Number(a?.liquidity?.usd) || 0)
    )[0] || null;
}
async function fetchFromDexScreener(address) {
    const data = await fetchJson(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`,
        'DexScreener'
    );
    const pair = selectPreferredPair(data?.pairs);
    if (!pair) throw new Error('DexScreener: no TON pool found');
    return {
        priceUsd: pair.priceUsd,
        priceTon: pair.priceNative,
        change24h: pair?.priceChange?.h24,
        url: typeof pair.url === 'string' ? pair.url : null,
        source: 'DexScreener'
    };
}
async function fetchFromGeckoTerminal(address) {
    // GeckoTerminal is CoinGecko's on-chain DEX data source and accepts contract addresses.
    const data = await fetchJson(
        `https://api.geckoterminal.com/api/v2/networks/ton/tokens/${encodeURIComponent(address)}`,
        'GeckoTerminal/CoinGecko'
    );
    const a = data?.data?.attributes;
    if (!a || a.price_usd == null) throw new Error('GeckoTerminal: token price not found');
    // The token endpoint guarantees USD price. Native TON price may not be present,
    // so keep it optional rather than displaying a fabricated conversion.
    return {
        priceUsd: a.price_usd,
        priceTon: a.price_in_native_currency ?? null,
        change24h: a?.price_change_percentage?.h24 ?? null,
        url: `https://www.geckoterminal.com/ton/tokens/${encodeURIComponent(address)}`,
        source: 'GeckoTerminal (CoinGecko)'
    };
}
function findDeDustPriceNode(data, address, tokenName) {
    const wantedAddress = String(address).toLowerCase();
    const wantedSymbol = String(tokenName).toLowerCase();
    const seen = new Set();
    const stack = [data];
    let symbolFallback = null;
    while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== 'object' || seen.has(node)) continue;
        seen.add(node);
        const strings = Object.values(node)
            .filter(v => typeof v === 'string')
            .map(v => v.toLowerCase());
        const hasAddress = strings.some(v => v === wantedAddress || v.includes(wantedAddress));
        const hasSymbol = strings.some(v => v === wantedSymbol);
        const priceUsd = node.priceUsd ?? node.price_usd ?? node.usdPrice ?? node.usd_price ??
            node.priceUSD ?? node.price?.usd ?? node.price?.USD ?? null;
        const priceTon = node.priceTon ?? node.price_ton ?? node.tonPrice ?? node.ton_price ??
            node.priceNative ?? node.price_native ?? node.price?.ton ?? node.price?.TON ?? null;
        const change24h = node.change24h ?? node.change_24h ?? node.priceChange24h ??
            node.price_change_24h ?? node.price_change_percentage_24h ?? null;
        if (hasAddress && (priceUsd != null || priceTon != null)) {
            return { priceUsd, priceTon, change24h };
        }
        if (!symbolFallback && hasSymbol && (priceUsd != null || priceTon != null)) {
            symbolFallback = { priceUsd, priceTon, change24h };
        }
        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') stack.push(value);
        }
    }
    return symbolFallback;
}
async function fetchFromDeDust(address, tokenName) {
    // DeDust exposes public v2 market endpoints. Try prices first, then assets,
    // and only accept an entry that matches this jetton address (symbol is a fallback).
    const endpoints = [
        'https://api.dedust.io/v2/prices',
        'https://api.dedust.io/v2/assets'
    ];
    const errors = [];
    for (const url of endpoints) {
        try {
            const data = await fetchJson(url, 'DeDust');
            const found = findDeDustPriceNode(data, address, tokenName);
            if (found && found.priceUsd != null) {
                return {
                    priceUsd: found.priceUsd,
                    priceTon: found.priceTon ?? null,
                    change24h: found.change24h ?? null,
                    url: `https://dedust.io/swap/TON/${encodeURIComponent(address)}`,
                    source: 'DeDust'
                };
            }
        } catch (err) {
            errors.push(err.message);
        }
    }
    throw new Error(`DeDust: token price not found${errors.length ? ` (${errors.join(' | ')})` : ''}`);
}
async function fetchTokenPrice(address, tokenName) {
    const now = Date.now();
    const cached = priceCache.get(address);
    if (cached && now - cached.savedAt < PRICE_CACHE_TTL_MS) {
        return { ...cached.value, cached: true, stale: false };
    }
    if (priceInFlight.has(address)) return priceInFlight.get(address);
    const promise = (async () => {
        const errors = [];
        // Primary: DexScreener. If it is rate-limited/unavailable, immediately use
        // GeckoTerminal/CoinGecko instead of telling the Telegram user to wait.
        for (const provider of [fetchFromDexScreener, fetchFromGeckoTerminal, (address) => fetchFromDeDust(address, tokenName)]) {
            try {
                const value = await provider(address);
                priceCache.set(address, { value, savedAt: Date.now() });
                return { ...value, cached: false, stale: false };
            } catch (err) {
                errors.push(`${err.provider || provider.name}: ${err.message}`);
                console.error(`[Price API] ${tokenName}: ${err.message}`);
            }
        }
        if (cached && now - cached.savedAt < PRICE_STALE_TTL_MS) {
            return { ...cached.value, cached: true, stale: true };
        }
        const err = new Error(`All price sources failed: ${errors.join(' | ')}`);
        err.allSourcesFailed = true;
        throw err;
    })();
    priceInFlight.set(address, promise);
    try { return await promise; }
    finally { priceInFlight.delete(address); }
}
function formatPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'N/A';
    if (number === 0) return '0';
    if (Math.abs(number) < 0.000001) return number.toPrecision(4);
    if (Math.abs(number) < 1) return number.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
    return number.toLocaleString('en-US', { maximumFractionDigits: 8 });
}
Object.keys(tokenConfigs).forEach(cmd => {
    bot.command(cmd, async (ctx) => {
        const userId = ctx.from.id;
        let isAdmin = ADMIN_IDS.includes(userId);
        if (!isAdmin && ctx.chat.type !== 'private') {
            try {
                const member = await ctx.getChatMember(userId);
                if (member.status === 'creator' || member.status === 'administrator') isAdmin = true;
            } catch (e) { console.log('Error checking admin status:', e); }
        }
        if (!isAdmin) return ctx.reply('🚫 ဤ Command ကို Admin များသာ အသုံးပြုခွင့် ရှိပါသည်။');
        const tokenInfo = tokenConfigs[cmd];
        const waitingMsg = await ctx.reply(`⏳ ${tokenInfo.name} Token ၏ Live Update ဈေးနှုန်းကို ဆွဲယူနေပါသည်...`);
        try {
            const result = await fetchTokenPrice(tokenInfo.address, tokenInfo.name);
            const priceUsd = formatPrice(result.priceUsd);
            const priceTon = result.priceTon == null ? null : formatPrice(result.priceTon);
            const rawChange24h = Number(result.change24h);
            const hasChange24h = Number.isFinite(rawChange24h);
            const changeEmoji = !hasChange24h ? '➖' : (rawChange24h >= 0 ? '📈' : '📉');
            const changeText = hasChange24h ? `${rawChange24h}%` : 'N/A';
            const cacheNote = result.stale
                ? '\n\n⚠️ Live API များခေတ္တမရသဖြင့် နောက်ဆုံးရရှိထားသော ဈေးနှုန်းကို ပြထားပါသည်။'
                : (result.cached ? '\n\nℹ️ 30 စက္ကန့်အတွင်း နောက်ဆုံးရရှိထားသော ဈေးနှုန်းဖြစ်ပါသည်။' : '');
            const priceMessage =
                `💎 *${tokenInfo.name} Token Price (Live Update)*\n\n` +
                `💵 ဈေးနှုန်း (USD): *$${priceUsd}*\n` +
                (priceTon ? `💠 ဈေးနှုန်း (TON): *${priceTon} TON*\n` : '') +
                `${changeEmoji} 24h ပြောင်းလဲမှု: *${changeText}*\n` +
                `📡 Source: *${result.source}*` +
                (result.url ? `\n\n🔗 [DEX တွင် သွားကြည့်ရန်](${result.url})` : '') +
                cacheNote;
            await ctx.telegram.editMessageText(ctx.chat.id, waitingMsg.message_id, null, priceMessage, {
                parse_mode: 'Markdown', disable_web_page_preview: true
            });
        } catch (err) {
            console.error(`[Price API] ${tokenInfo.name} all sources failed:`, err);
            await ctx.telegram.editMessageText(
                ctx.chat.id, waitingMsg.message_id, null,
                `🚫 ${tokenInfo.name} ဈေးနှုန်းကို DexScreener, GeckoTerminal/CoinGecko နှင့် DeDust တို့မှ ခေတ္တဆွဲယူ၍ မရသေးပါ။`
            ).catch(editErr => console.error('Failed to edit price error message:', editErr));
        }
    });
});
// --- ၅။ Message Monitoring (Bad Words, Link, Bot Mention & Admin Bypass) ---
// Bad-word violations: 1st offence -> auto warning, 2nd -> auto ban.
// Link / bot spam violations keep the original admin-approval workflow.
const BAD_WORDS = Object.freeze([
    'လီး', 'ငါလိုး', 'ငါလိုးမ', 'မအေလိုး', 'စောက်ရူး', 'နှမလိုး', 'bitch', 'fuck you', 'fuck',
    'မအေယိုး', 'မအေရိုး', 'ဖာခံ', 'ဖာသည်', 'ဖင်ခံ', 'ငါယိုးမ', 'ငါရိုးမ', 'နှမိုးလ',
    'dick', 'pussy', 'sex', 'ass', 'အီး', 'ချီး', 'သေး', 'လိင်တံ', 'လရည်'
]);

// These can also appear in ordinary Burmese sentences, so only match them
// when separated from neighbouring Myanmar-script characters.
const AMBIGUOUS_MYANMAR_WORDS = new Set(['အီး', 'ချီး', 'သေး']);
const MYANMAR_CHARACTER = /\p{Script=Myanmar}/u;
const LATIN_BAD_WORDS = BAD_WORDS.filter(w => /^[a-z ]+$/.test(w));
const MYANMAR_BAD_WORDS = BAD_WORDS.filter(w => !/^[a-z ]+$/.test(w));
const latinPatterns = LATIN_BAD_WORDS.map(word => {
    // English word boundaries: 'ass' must not match 'class'/'pass'.
    const letters = word.split(' ').join('\\s+');
    return new RegExp(`(?<![a-z0-9])${letters}(?![a-z0-9])`, 'i');
});

function normalizeModerationText(value) {
    return String(value || '')
        .normalize('NFC')
        .toLowerCase()
        // Remove invisible separators used to evade a bad-word filter.
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
}

function containsProhibitedWord(rawText) {
    const text = normalizeModerationText(rawText);
    if (!text) return false;
    if (latinPatterns.some(pattern => pattern.test(text))) return true;

    return MYANMAR_BAD_WORDS.some(word => {
        if (!AMBIGUOUS_MYANMAR_WORDS.has(word)) return text.includes(word);
        let position = text.indexOf(word);
        while (position !== -1) {
            const before = position > 0 ? text[position - 1] : '';
            const after = text.slice(position + word.length);
            const nextCodepoint = [...after][0] || '';
            // Look backward by codepoint (important if user text contains emoji).
            const prevCodepoint = [...text.slice(0, position)].at(-1) || before;
            if ((!prevCodepoint || !MYANMAR_CHARACTER.test(prevCodepoint)) &&
                (!nextCodepoint || !MYANMAR_CHARACTER.test(nextCodepoint))) return true;
            position = text.indexOf(word, position + 1);
        }
        return false;
    });
}

const profanityWarnings = new Map(); // chatId:userId -> count; resets on restart.
const WORD_NOTICE_DELETE_MS = 12000;
const allowedBotIds = new Set(['8628536738', '8628586738']);
function isSleepyPriceBot(user) {
    return Boolean(user && (
        allowedBotIds.has(String(user.id)) ||
        String(user.username || '').toLowerCase() === 'sleepypricebot'
    ));
}

function deleteNoticeLater(telegram, chatId, messageId, delayMs = WORD_NOTICE_DELETE_MS) {
    const handle = setTimeout(() => {
        telegram.deleteMessage(chatId, messageId).catch(() => {});
    }, delayMs);
    if (typeof handle.unref === 'function') handle.unref();
}

// Handle regular text, image/video captions, and edited messages.
bot.on(['message', 'edited_message'], async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return;
    const message = ctx.message || ctx.editedMessage;
    if (!message || message.sender_chat) return; // anonymous admin/channel sender
    const messageText = message.text || message.caption || '';
    if (!messageText) return;

    const userId = ctx.from.id;
    const userName = ctx.from.first_name || 'User';
    const chatId = ctx.chat.id;
    const normalized = normalizeModerationText(messageText);

    // Keep admin and Sleepy Price Bot exemptions from the existing bot.
    if (ADMIN_IDS.includes(userId) || isSleepyPriceBot(ctx.from)) return;
    try {
        const member = await ctx.telegram.getChatMember(chatId, userId);
        if (member.status === 'creator' || member.status === 'administrator') return;
    } catch (err) {
        // Do not risk auto-banning an admin if Telegram's admin check fails.
        console.error('[Moderator] Cannot check member permissions:', err.message);
        return;
    }

    if (containsProhibitedWord(messageText)) {
        try {
            await ctx.telegram.deleteMessage(chatId, message.message_id);
        } catch (err) {
            console.error('[Moderator] Cannot delete prohibited message:', err.message);
            return; // No escalation if message deletion failed.
        }

        const warningKey = `${chatId}:${userId}`;
        const previous = profanityWarnings.get(warningKey) || 0;
        let outcome = 'WARNING';
        if (previous === 0) {
            profanityWarnings.set(warningKey, 1);
            const notice = await ctx.reply(
                `⚠️ ${userName}၊ ဆဲဆိုရိုင်းစိုင်းသော စကားများကို ခွင့်မပြုပါ။ ` +
                'ယခု ပထမအကြိမ် သတိပေးခြင်းဖြစ်ပြီး ထပ်မံချိုးဖောက်ပါက Group မှ Ban ခံရပါမည်။'
            ).catch(err => { console.error('[Moderator] Warning notice:', err.message); return null; });
            if (notice) deleteNoticeLater(ctx.telegram, chatId, notice.message_id);
        } else {
            try {
                // Telegram ban operation is server-side and requires bot admin privileges.
                await ctx.telegram.banChatMember(chatId, userId);
                profanityWarnings.set(warningKey, previous + 1);
                outcome = 'BANNED';
                await ctx.reply(`🚫 ${userName} ကို ဆဲဆိုမှု ထပ်မံပြုလုပ်သောကြောင့် Group မှ Ban လိုက်ပါပြီ။`)
                    .catch(err => console.error('[Moderator] Ban notice:', err.message));
            } catch (err) {
                console.error('[Moderator] Auto-ban failed. Check Ban Users permission:', err);
                outcome = 'BAN_FAILED';
                for (const adminId of ADMIN_IDS) {
                    await ctx.telegram.sendMessage(adminId,
                        `🚨 Auto-ban FAILED in chat ${chatId} for user ${userId}. ` +
                        'Check the bot\'s Ban Users permission.'
                    ).catch(() => {});
                }
            }
        }
        for (const adminId of ADMIN_IDS) {
            await ctx.telegram.sendMessage(adminId,
                `🛡 Bad Words: ${outcome}\nChat: ${chatId}\nUser: ${userName} (${userId})\n` +
                `Message: ${messageText.slice(0, 350)}`
            ).catch(() => {});
        }
        console.log(`[Bad Words] chat=${chatId} user=${userId} outcome=${outcome}`);
        return;
    }

    // Existing link and bot-mention admin-approval moderation, with valid link regexes.
    const isBotMention = /@\w+bot\b/i.test(messageText) || normalized.includes('@webbinanceappbot');
    const linkRegex = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,})(?:[^\s]*)/i;
    const hasLink = linkRegex.test(messageText);
    let violationReason = '';
    let silentDelete = false;

    if (isBotMention) {
        violationReason = 'အခြား Bot အမည်များကို ခေါ်ယူအသုံးပြုခြင်း';
    } else if (hasLink) {
        const linkMatch = messageText.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)(?:\?([^\s]+))?/i);
        if (linkMatch) {
            const botName = linkMatch[1].toLowerCase();
            const inviteCode = linkMatch[2] || '';
            if (inviteCode) {
                const linkKey = `${chatId}_${userId}_${botName}_${inviteCode}`;
                const previousShare = linkShareHistory.get(linkKey);
                if (previousShare && Date.now() - previousShare.time < 60 * 60 * 1000) {
                    violationReason = 'တူညီသော Bot Link နှင့် Code ကို တစ်နာရီအတွင်း ထပ်မံတင်ခြင်း';
                    silentDelete = true;
                } else {
                    linkShareHistory.set(linkKey, { time: Date.now() });
                }
            }
        } else {
            violationReason = 'ခွင့်မပြုထားသော Link များ တင်ခြင်း';
        }
    }

    if (!violationReason) return;
    try { await ctx.telegram.deleteMessage(chatId, message.message_id); }
    catch (err) { console.error('[Moderator] Cannot delete spam:', err.message); return; }
    if (silentDelete) return;

    const warnings = (userWarnings.get(`${chatId}:${userId}`) || 0) + 1;
    userWarnings.set(`${chatId}:${userId}`, warnings);
    const punishmentType = warnings === 1 ? 'Warning ပေးရန်' :
        (warnings === 2 ? '၁၀ မိနစ် Muteရန်' :
        (warnings === 3 ? '၁ နာရီ Muteရန်' : 'Group မှ Banရန်'));
    const actionId = `punish_${userId}_${Date.now()}_${message.message_id}`;
    pendingPunishments.set(actionId, { chatId, userId, userName, warnings, timestamp: Date.now() });
    for (const adminId of ADMIN_IDS) {
        try {
            await ctx.telegram.sendMessage(
                adminId,
                `🚨 စည်းကမ်းဖောက်ဖျက်မှု အတည်ပြုရန်\n\n` +
                `- အသုံးပြုသူ: ${userName} (ID: ${userId})\n` +
                `- အကြောင်းရင်း: ${violationReason}\n` +
                `- ချိုးဖောက်မှုအကြိမ်ရေ: ${warnings} ကြိမ်\n` +
                `- အကြံပြုအရေးယူမှု: ${punishmentType}\n` +
                `- မူရင်းစာသား: "${messageText.slice(0, 600)}"`,
                { ...Markup.inlineKeyboard([
                    [Markup.button.callback('✅ အတည်ပြုမည် (Approve)', `approve_${actionId}`)],
                    [Markup.button.callback('❌ ပယ်ချမည် (Reject)', `reject_${actionId}`)]
                ]) }
            );
        } catch (err) {
            console.log(`Admin (ID: ${adminId}) ဆီသို့ မက်ဆေ့ခ်ျပို့၍ မရပါ။`);
        }
    }
    const notice = await ctx.reply(
        `${userName}၊ သင့်၏ မက်ဆေ့ခ်ျသည် စည်းကမ်းနှင့် မကိုက်ညီသဖြင့် ဖျက်လိုက်ပါပြီ။ ` +
        'Admin ၏ ဆုံးဖြတ်ချက်ကို စောင့်ဆိုင်းနေပါသည်။'
    ).catch(() => null);
    if (notice) deleteNoticeLater(ctx.telegram, chatId, notice.message_id, 6000);
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
                await ctx.telegram.sendMessage(punishData.chatId, `⚠️ *Warning:* ${punishData.userName}၊ စည်းကမ်းချက်များကို လိုက်နာပေးပါ။`);
            } else if (punishData.warnings === 2) {
                const muteUntil = Math.floor(Date.now() / 1000) + (10 * 60);
                await ctx.telegram.restrictChatMember(punishData.chatId, punishData.userId, {
                    permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false, can_add_web_page_previews: false },
                    until_date: muteUntil
                });
                await ctx.telegram.sendMessage(punishData.chatId, `🔇 *Punishment:* ${punishData.userName} ကို *၁၀ မိနစ်* Mute လိုက်ပါပြီ။`);
            } else if (punishData.warnings === 3) {
                const muteUntil = Math.floor(Date.now() / 1000) + (60 * 60);
                await ctx.telegram.restrictChatMember(punishData.chatId, punishData.userId, {
                    permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false, can_add_web_page_previews: false },
                    until_date: muteUntil
                });
                await ctx.telegram.sendMessage(punishData.chatId, `🔇 *Punishment:* ${punishData.userName} ကို *၁ နာရီ* Mute လိုက်ပါပြီ။`);
            } else {
                await ctx.telegram.banChatMember(punishData.chatId, punishData.userId);
                await ctx.telegram.sendMessage(punishData.chatId, `🚫 *Punishment:* ${punishData.userName} ကို Group မှ ထုတ်ပယ်လိုက်ပါပြီ (Ban)။`);
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
        // ⭐ [ပြင်ဆင်ချက် ၂] - Sleepy Price Bot Group ထဲဝင်လာပါက Kick မထုတ်ဘဲ ခွင့်ပြုပေးခြင်း
        // (ID ဂဏန်းသာမက Username ကိုပါ အတိအကျ တိုက်စစ်ထားပါသည်)
        if (
            member.id.toString() === "8628536738" ||
            member.id.toString() === "8628586738" ||
            (member.username && member.username.toLowerCase() === "sleepypricebot")
        ) {
            continue; // Kick ထုတ်မည့် အဆင့်များကို ကျော်သွားပါမည် (return အစား continue သုံးထားပါသည်)
        }
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
bot.catch((err, ctx) => {
    console.error(`Telegraf handler error for update ${ctx?.update?.update_id ?? 'unknown'}:`, err);
});
bot.launch()
    .then(() => console.log('Telegram bot polling started successfully.'))
    .catch(err => {
        console.error('Telegram bot launch failed:', err);
    });
process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED PROMISE REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
console.log('Bot startup initialized safely...');
