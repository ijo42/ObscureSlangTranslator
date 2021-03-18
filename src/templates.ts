import {
    BotCommand,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    ReplyKeyboardMarkup,
} from "node-telegram-bot-api";
import { bot } from "./app";
import { editTerm, fuzzySearch, fuzzySearchWithLen, pushTerm } from "./utils/fuzzySearch";
import { formatAnswer, formatAnswerUnpreceded, grabUsrID, reformat } from "./utils/formatting";
import { texts } from "./texts";
import { format } from "util";
import prisma from "./db";
import { hasRights } from "./utils/moderate";

export interface Command extends BotCommand {
    regexp: RegExp;
    command: string;
    description: string;
    callback: ((msg: Message, match: RegExpExecArray | null) => void)
}

export interface ObscureEntry {
    id: number;
    term: string;
    value: string;
    synonyms: string[];
}

export interface ModerateAction extends ObscureEntry {
    stagingId: number;
    author: string;
    reviewer: number;
    reviewingChat: number;
    msgId: number;
}

interface KeyboardButton extends InlineKeyboardButton {
    callback: (query: CallbackQuery) => Promise<any>;
}

export interface Keyboard extends InlineKeyboardMarkup {
    inline_keyboard: KeyboardButton[][];
    restrictedTo: number | boolean;
}

export async function processReplenishment(entry: ObscureEntry, author: string, staging: boolean = true): Promise<number> {
    if (staging)
        await prisma.staging.create({
            data: {
                term: entry.term,
                value: entry.value,
                author: author
            },
            select: {
                id: true
            }
        }).then(val => {
            entry.id = val.id;
        });
    else
        await prisma.obscure.create({
            data: {
                term: entry.term,
                value: entry.value,
                author: author
            },
            select: {
                id: true
            }
        }).then(val => {
            entry.id = val.id;
            pushTerm(entry)
        });
    return entry.id;
}

export function keyboardWithConfirmation(onForce: () => void, text: string, restrictedTo: number | boolean = false): Keyboard {
    return {
        inline_keyboard: [
            [{
                text: text, callback_data: 'F',
                callback: () => Promise.resolve(onForce())
            }]
        ],
        restrictedTo: restrictedTo
    }

}

export function generateSynonymMarkup(entry: { term: string; value: string; }): ReplyKeyboardMarkup {
    const matchedEnters: ReadonlyArray<String> = fuzzySearchWithLen(
        [entry.term, entry.value], 3)
        .filter(value => !!value.value)
        .map((value: ObscureEntry) =>
            formatAnswerUnpreceded(value));

    let keyboard: ReplyKeyboardMarkup = {
        one_time_keyboard: true,
        keyboard: [[], [], []],
        selective: true
    };

    for (let i = 0; i < Math.min(3 - 1, matchedEnters.length); i++) {
        if (!matchedEnters[i])
            continue;

        keyboard.keyboard[i]?.push({
            text: <string>matchedEnters[i]
        });
    }
    return keyboard;
}

export function moderateMarkup(match: ModerateAction, restrictedTo: number | boolean = false): Keyboard {
    return {
        inline_keyboard: [
            [
                {
                    text: 'ACCEPT',
                    callback_data: 'A',
                    callback: () => {
                        return processReplenishment(match, match.author, false).then((acceptedAs) =>
                            prisma.staging.update({
                                where: {
                                    id: match.stagingId
                                },
                                data: {
                                    status: 'accepted',
                                    reviewed_by: match.reviewer,
                                    accepted_as: acceptedAs,
                                    updated: new Date()
                                }
                            }).then(() => {
                                bot.sendMessage(match.reviewingChat, "Successful accepted");
                                return bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.accepted, formatAnswer(match)), {
                                    parse_mode: "MarkdownV2"
                                });
                            }).catch((e: any) =>
                                bot.sendMessage(match.reviewer, e.stack)))
                    }
                },
                {
                    text: 'DECLINE',
                    callback_data: 'D',
                    callback: () =>
                        prisma.staging.update({
                            where: {
                                id: match.stagingId
                            },
                            data: {
                                status: 'declined',
                                reviewed_by: match.reviewer,
                                updated: new Date()
                            }
                        }).then(() => {
                            bot.sendMessage(match.reviewingChat, "Successful declined");
                            return bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.declined, formatAnswer(match)), {
                                parse_mode: "MarkdownV2"
                            });
                        }).catch((e: any) =>
                            bot.sendMessage(match.reviewer, e.stack))
                }
            ],
            [
                {
                    text: 'REQUEST CHANGES',
                    callback_data: 'R',
                    callback: () =>
                        prisma.staging.update({
                            where: {
                                id: match.stagingId
                            },
                            data: {
                                status: 'request_changes',
                                reviewed_by: match.reviewer,
                                updated: new Date()
                            }
                        }).then(() => {
                            bot.sendMessage(match.reviewingChat, "Successful requested");
                            return bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.request_changes, formatAnswer(match)), {
                                parse_mode: "MarkdownV2"
                            });
                        }).catch((e: any) =>
                            bot.sendMessage(match.reviewer, e.stack))
                },
                {
                    text: 'SYNONYM',
                    callback_data: 'S',
                    callback: () => {
                        const callback: (synonymTo: ObscureEntry) => void = (synonymTo: ObscureEntry) =>
                            // to resolve https://github.com/prisma/prisma/issues/5078
                            prisma.$executeRaw`UPDATE obscure SET synonyms = array_prepend(${match.term}, synonyms) WHERE id = ${synonymTo.id}`
                                .then(() => {
                                    prisma.staging.update({
                                        where: {
                                            id: match.stagingId
                                        },
                                        data: {
                                            status: "synonym",
                                            reviewed_by: match.reviewer,
                                            accepted_as: synonymTo.id,
                                            updated: new Date()
                                        }
                                    }).then(() => {
                                        editTerm(synonymTo, (t => t.synonyms.push(match.term)));
                                        bot.sendMessage(match.reviewingChat, "Successful marked as Synonym");
                                        return bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.synonym, formatAnswer(match), formatAnswer(synonymTo)), {
                                            parse_mode: "MarkdownV2"
                                        });
                                    }).catch(e => console.error(e));
                                }).catch(e => console.error(e));

                        return bot.sendMessage(match.reviewingChat, "Select Synonym (must reply)", {
                            reply_markup: generateSynonymMarkup(match),
                            reply_to_message_id: match.msgId
                        }).then(m => {
                            const listener = bot.onReplyToMessage(m.chat.id, m.message_id, (msg => {

                                if (!(msg.text && msg.from?.id == match.reviewer &&
                                    /^([\wа-яА-Я]{2,})(?:(?:\s?-\s?)|\s+)([\wа-яА-Я,.)(\s-]{2,})$/
                                        .test(msg.text)))
                                    return;

                                let fuzzy = fuzzySearch(msg.text?.replace(/(\s)?-(\s)?/, " ").split(" "))
                                if (fuzzy) {
                                    bot.removeReplyListener(listener);
                                    callback(fuzzy);
                                } else
                                    bot.sendMessage(msg.chat.id, "I didn't find this term. Try to provide over inline");
                            }))
                        });
                    }
                }
            ]
        ],
        restrictedTo: restrictedTo
    }
}

export function categorizeMarkup(chatId: number, msgId: number, restrictedTo: number): Keyboard {
    return {
        inline_keyboard: [
            [
                {
                    text: 'Create new',
                    callback_data: 'CREATE',
                    callback: () =>
                        bot.editMessageText("Reply to this message w/ name of new Category", {
                            message_id: msgId, chat_id: chatId
                        }).then(message => {
                            if (message) {
                                const listenId = bot.onReplyToMessage(chatId, msgId, (msg) => {
                                    let uid;
                                    if ((uid = hasRights(msg.from?.id)) && msg.text && /[\wа-яА-Я]+/.test(msg.text)) {
                                        prisma.categories.create({
                                            data: {
                                                value: reformat([msg.text]),
                                                author: uid
                                            },
                                            select: {
                                                value: true,
                                                moderators: true
                                            }
                                        }).then(ret =>
                                            bot.sendMessage(ret.moderators.user_id,
                                                `Successful created new category ${ret.value}`))
                                            .then(() => bot.removeReplyListener(listenId));
                                    } else bot.sendMessage(msg.chat.id, texts.hasNoRights);
                                });
                            }
                        })
                }
            ]
        ],
        restrictedTo: restrictedTo
    }
}