import { Command, keyboardWithConfirmation, moderateMarkup, processReplenishment } from "./templates";
import { texts } from "./texts";
import { bot } from "./app";
import { capitalize, formatAnswer, formatDBSize, formatUsername } from "./utils/formatting";
import { fuzzyFormat, fuzzySearch } from "./utils/fuzzySearch";
import { registerCallback } from "./inLineHandler";
import { hasRights, promoteUser } from "./utils/moderate";
import { format } from "util";
import prisma from "./db";

export const commands: Command[] = [
    {
        command: '/size',
        regexp: /\/size/,
        description: 'Get last DB index',
        callback: (msg => {
            const chatId = msg.chat.id;
            return prisma.obscure.count().then(num => bot.sendMessage(chatId, formatDBSize(num)));
        })
    },

    {
        command: '/add',
        regexp: /^(\/add )?([a-zA-Z0-9_а-яА-Я]{2,})(?:(?:\s?-\s?)|\s+)([a-zA-Z0-9_а-яА-Я,.\-)( ]{2,})/,
        description: 'Command to suggest a new term',
        callback: (msg, match) => {
            if (!match || !msg.from || (msg.chat.type !== 'private' && !match[1]))
                return;
            const chatId = msg.chat.id;
            const vars: string[] = capitalize([match[2], match[3]]);
            const fuzzy = fuzzySearch(vars);
            const entry = {
                id: -1, synonyms: [],
                term: <string>vars[0],
                value: <string>vars[1]
            };
            const upload = () =>
                processReplenishment(entry, msg.from ? formatUsername(msg.from) : '').then(acceptedAs =>
                    bot.sendMessage(msg.chat.id, formatDBSize(acceptedAs)))

            if (fuzzy) {
                const keyboard = keyboardWithConfirmation(upload, 'Force', msg.from.id);
                return bot.sendMessage(chatId, `Are you sure that this is not a duplicate for
*${formatAnswer(fuzzy)}*
If mistake, click \`Force\``, {
                    reply_markup: keyboard,
                    parse_mode: "MarkdownV2"
                }).then(answer => registerCallback(answer, keyboard));
            } else
                return upload();
        }
    },

    {
        command: '/start',
        regexp: /\/start/,
        description: 'Welcome-Command',
        callback: (msg) => bot.sendMessage(msg.chat.id, texts.welcome)
    },
    {
        command: '/get',
        regexp: /\/get ([a-zA-Z0-9_а-яА-Я ]+)/,
        description: 'Get Fuzzy Terms',
        callback: (msg, match) =>
            bot.sendMessage(msg.chat.id, fuzzyFormat(match), {
                parse_mode: "MarkdownV2"
            })
    },
    {
        command: '/promote',
        regexp: /\/promote/,
        description: 'Promotes a user',
        callback: (msg) => {
            const promoterId = msg.from?.id;
            if (promoterId && hasRights(promoterId)) {
                if (msg.reply_to_message?.from && !msg.reply_to_message.from.is_bot) {
                    const promotable = msg.reply_to_message.from;
                    const keyboard = keyboardWithConfirmation(() =>
                        promoteUser(promotable.id, promoterId).then(() => {
                            bot.sendMessage(msg.chat.id, texts.successfulPromoting);
                            bot.sendMessage(promotable.id, texts.promoteAnnounce)
                                .catch(() => bot.sendMessage(msg.chat.id,
                                    `${promotable.username ? "@" : ""}${formatUsername(promotable)}, ` +
                                    texts.promoteAnnounce));

                        }).catch(e => bot.sendMessage(promoterId, e.stack)), 'Promote', promoterId);

                    return bot.sendMessage(msg.chat.id, format(texts.confirmPromotion, `${promotable.username ? "@" : ""}${formatUsername(promotable)}`), {
                        reply_markup: keyboard
                    }).then(value => registerCallback(value, keyboard))
                } else
                    return bot.sendMessage(msg.chat.id, texts.provideAUser, {
                        parse_mode: "MarkdownV2"
                    })
            } else return bot.sendMessage(msg.chat.id, texts.hasNoRights);
        }
    },
    {
        command: '/moderate',
        regexp: /\/moderate/, description: 'Moderate an staging entry',
        callback: msg => {
            if (!msg.from || !hasRights(msg.from?.id))
                return bot.sendMessage(msg.chat.id, texts.hasNoRights);
            else
                return prisma.staging.findFirst({
                    take: 1,
                    where: {
                        status: 'waiting'
                    },
                    select: {
                        "id": true,
                        "value": true,
                        "term": true,
                        "author": true
                    }
                }).then(res => {
                    if (!res) {
                        bot.sendMessage(msg.chat.id, `No another staging`);
                        return;
                    }
                    if (!msg.from)
                        throw new Error("msg.from is undefined");

                    const match = {
                        id: -1, synonyms: [],
                        stagingId: res.id,
                        value: res.value,
                        term: res.term,
                        author: res.author,
                        reviewer: msg.from.id,
                        reviewingChat: msg.chat.id
                    };
                    const keyboard = moderateMarkup(match, msg.from.id);

                    bot.sendMessage(msg.chat.id, `Accept: ${formatAnswer(match)}`, {
                        parse_mode: "MarkdownV2",
                        reply_markup: keyboard
                    }).then(r => registerCallback(r, keyboard));
                }).catch((e: any) => console.error(e.stack));
        }
    }
];