import {
    categorizeMarkup,
    Command,
    concreteTerm,
    keyboardWithConfirmation,
    moderateMarkup,
    processReplenishment
} from "./templates";
import { texts } from "./texts";
import { bot } from "./app";
import {
    capitalize,
    formatAnswer,
    formatDBSize,
    formatDuplicationCheck,
    formatMention,
    formatUsername,
    formatUserPromotion,
    reformat
} from "./utils/formatting";
import { eraseTerm, fuzzyFormat, fuzzySearch } from "./utils/fuzzySearch";
import { registerCallback } from "./inLineHandler";
import { hasRights, promoteUser } from "./utils/moderate";
import prisma from "./db";
import regexpBuild, { baseRegexp, compiledRegexp } from "./utils/regexpBuilder";
import { sendPic } from "./utils/drawing";
import TelegramBot from "node-telegram-bot-api";
import { requestIDKFeedback, requestTermFeedback } from "./utils/telemetry";

export const commands: Command[] = [
    {
        command: '/size',
        regexp: regexpBuild("size"),
        description: texts.commandsAround.size.desk,
        callback: (msg => {
            const chatId = msg.chat.id;
            return prisma.obscure.count().then(num => bot.sendMessage(chatId, formatDBSize(num)));
        })
    },

    {
        command: '/add',
        regexp: regexpBuild('add', baseRegexp.lazyMatch),
        description: texts.commandsAround.add.desk,
        callback: (msg, match) => {
            if (!match || !msg.from)
                return;
            const chatId = msg.chat.id;
            const vars: string[] = reformat(
                capitalize([match[1], match[2]])
            );
            const fuzzy = fuzzySearch(vars);
            if (!(vars[0] && vars[1]))
                throw new Error("Empty term array");

            const entry = {
                id: -1, synonyms: [],
                term: vars[0],
                value: vars[1]
            };
            const upload = () =>
                processReplenishment(entry, msg.from ? formatUsername(msg.from) : '')
                    .then(() =>
                        bot.sendMessage(msg.chat.id, `${texts.thx} ${texts.reviewPromise}`))
                    .catch(e => bot.sendMessage(msg.chat.id, e))

            if (fuzzy) {
                const keyboard = keyboardWithConfirmation(upload, 'Force', msg.from.id);
                return bot.sendMessage(chatId, formatDuplicationCheck(fuzzy), {
                    reply_markup: keyboard,
                    parse_mode: "MarkdownV2"
                }).then(answer => registerCallback(answer, keyboard));
            } else
                return upload();
        }
    },

    {
        command: '/start',
        regexp: regexpBuild("start"),
        description: 'Welcome-Command',
        callback: (msg) => bot.sendMessage(msg.chat.id, texts.welcome)
    },
    {
        command: '/get',
        regexp: regexpBuild("get", baseRegexp.searchableExp),
        description: texts.commandsAround.get.desk,
        callback: (msg, match) =>
            bot.sendMessage(msg.chat.id, fuzzyFormat(match), {
                parse_mode: "MarkdownV2"
            })
    },
    {
        command: '/promote',
        regexp: regexpBuild("promote"),
        description: texts.commandsAround.promote.desk,
        callback: (msg) => {
            const promoterId = msg.from?.id;
            if (promoterId && hasRights(promoterId)) {
                if (msg.reply_to_message?.from && !msg.reply_to_message.from.is_bot) {
                    const promotable = msg.reply_to_message.from;
                    const keyboard = keyboardWithConfirmation(() =>
                        promoteUser(promotable.id, promoterId).then(() => {
                            if (hasRights(promotable.id)) {
                                bot.sendMessage(msg.chat.id, "Already has rights")
                                return;
                            }
                            bot.sendMessage(msg.chat.id, texts.successfulPromoting);
                            bot.sendMessage(promotable.id, texts.promoteAnnounce)
                                .catch(() => bot.sendMessage(msg.chat.id,
                                    `${formatMention(promotable)}, ` +
                                    texts.promoteAnnounce));

                        }).catch(e => bot.sendMessage(promoterId, e.stack)), 'Promote', promoterId);

                    return bot.sendMessage(msg.chat.id, formatUserPromotion(texts.confirmPromotion, promotable), {
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
        regexp: regexpBuild("moderate"), description: texts.commandsAround.moderate.desk,
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
                        bot.sendMessage(msg.chat.id, texts.noStaging);
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
                        reviewingChat: msg.chat.id,
                        msgId: msg.message_id
                    };
                    const keyboard = moderateMarkup(match, msg.from.id);

                    bot.sendMessage(msg.chat.id, `Accept: ${formatAnswer(match)}`, {
                        parse_mode: "MarkdownV2",
                        reply_markup: keyboard
                    }).then(r => registerCallback(r, keyboard));
                }).catch((e: any) => console.error(e.stack));
        }
    },
    {
        regexp: regexpBuild("picture", baseRegexp.searchableExp), command: '/picture',
        description: texts.commandsAround.picture.desk, callback: (msg, match) => {
            let entry = fuzzySearch(match);
            if (entry) {
                sendPic(msg.chat.id, entry);
                requestTermFeedback(entry, msg);
            } else {
                bot.sendMessage(msg.chat.id, 'IDK');
                requestIDKFeedback(msg);
            }
        }
    },
    {
        regexp: regexpBuild("category"), command: '/category',
        description: texts.commandsAround.category.desk,
        callback: (msg) => {
            if (msg.from && hasRights(msg.from.id)) {
                const keyboard = categorizeMarkup(msg.chat.id, msg.from?.id)
                bot.sendMessage(msg.chat.id, 'Choose an action', {
                    reply_markup: keyboard
                }).then(r => registerCallback(r, keyboard));
            }
        }
    },
    {
        regexp: regexpBuild("delete", baseRegexp.fullMatch), command: '/delete',
        description: texts.commandsAround.delete.desk,
        callback: (msg, match) => {
            if (msg.from && hasRights(msg.from.id)) {
                const obscureTerm = fuzzySearch(match);
                if (!obscureTerm) {
                    bot.sendMessage(msg.chat.id, 'Not found');
                    return;
                }
                const confirm = keyboardWithConfirmation(() => {
                    console.log(`Deleted term ${JSON.stringify(obscureTerm)}`)
                    prisma.obscure.delete({
                        where: {
                            id: obscureTerm.id
                        }
                    }).then(() => eraseTerm(obscureTerm))
                        .then(() => bot.sendMessage(msg.chat.id, 'Successful'));
                }, 'Force', msg.from.id);
                bot.sendMessage(msg.chat.id, concreteTerm(obscureTerm), {
                    reply_markup: confirm
                }).then(r => registerCallback(r, confirm));
            } else bot.sendMessage(msg.chat.id, texts.hasNoRights);
        }
    }
];
export const defaultCommand = {
    regexp: compiledRegexp.searchableExp,
    callback: (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
        if (msg.from && msg.chat.type == 'private' && msg.text && !msg.text.startsWith('/') && !msg.reply_to_message) {
            const entry = fuzzySearch(match);
            if (entry) {
                sendPic(msg.chat.id, entry);
                requestTermFeedback(entry, msg, true);
            } else {
                bot.sendMessage(msg.chat.id, 'IDK');
                requestIDKFeedback(msg);
            }
        }
    }
}