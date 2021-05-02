import TelegramBot from "node-telegram-bot-api";
import { bot } from "../app";
import {
    editTerm,
    findAndValidateCategory,
    findAndValidateTerm,
    findByIds,
    fuzzySearchWithLen,
    pushTerm,
} from "../utils/fuzzySearch";
import { BaseFormatting, TelegramFormatting } from "../utils/formatting";
import { texts } from "../texts";
import { format } from "util";
import prisma from "../db";
import { registerCallback } from "./inLineHandler";
import { hasRights } from "../utils/moderate";
import { compiledRegexp } from "../utils/regexpBuilder";
import { collectTelemetry, ObscureEntry } from "../templates";
import { TelegramInteraction } from "../db/interaction";

export interface Command extends TelegramBot.BotCommand {
    regexp: RegExp;
    command: string;
    description: string;
    callback: ((msg: TelegramBot.Message, match: RegExpExecArray | null) => void)
}

export interface ModerateAction extends ObscureEntry {
    stagingId: number;
    author: TelegramInteraction.User;
    reviewer: number;
    reviewingChat: number;
    msgId: number;
}

interface KeyboardButton extends TelegramBot.InlineKeyboardButton {
    callback: (query: TelegramBot.CallbackQuery) => void;
}

export interface Keyboard extends TelegramBot.InlineKeyboardMarkup {
    inline_keyboard: KeyboardButton[][];
    restrictedTo: number | boolean;
}

function processCategory(msg: string, author: TelegramInteraction.User): Promise<string> {
    return prisma.categories.create({
        data: {
            value: BaseFormatting.reformatStr(msg),
            users: TelegramInteraction.userValidate(author),
        },
        select: {
            value: true,
        },
    })
        .then(r => r.value);
}

export async function processReplenishment(entry: ObscureEntry, author: TelegramInteraction.User, staging = true): Promise<ObscureEntry> {
    if (staging) {
        await TelegramInteraction.pushStaging(entry, author)
            .then(val => {
                entry.id = val.id;
            });
    } else {
        await TelegramInteraction.pushEntry(entry)
            .then(val => {
                entry.id = val.id;
                pushTerm(entry);
            });
    }
    return entry;
}

export function keyboardWithConfirmation(onForce: () => void, text: string, restrictedTo: number | boolean = false): Keyboard {
    return {
        inline_keyboard: [
            [{
                text, callback_data: "F",
                callback: () => onForce(),
            }],
        ],
        restrictedTo,
    };

}

function genNStringMarkup(matchedEnters: ReadonlyArray<string>): TelegramBot.ReplyKeyboardMarkup {
    const keyboard: TelegramBot.ReplyKeyboardMarkup = {
        one_time_keyboard: true,
        keyboard: [[], [], []],
        selective: true,
    };

    for (let i = 0; i < Math.min(3 - 1, matchedEnters.length); i++) {
        if (!matchedEnters[i]) {
            continue;
        }

        keyboard.keyboard[i]?.push({
            text: <string>matchedEnters[i],
        });
    }
    return keyboard;
}

export function moderateMarkup(match: ModerateAction, restrictedTo: number | boolean = false): Keyboard {
    return {
        inline_keyboard: [
            [
                {
                    text: "ACCEPT",
                    callback_data: "A",
                    callback() {
                        return processReplenishment(match, match.author, false)
                            .then(acceptedAs => prisma.staging.update({
                                where: {
                                    id: match.stagingId,
                                },
                                data: {
                                    status: "accepted",
                                    reviewed_by: hasRights(match.reviewer),
                                    accepted_as: acceptedAs.id,
                                    updated: new Date(),
                                },
                                select: {},
                            })
                                .then(() => {
                                    bot.sendMessage(match.reviewingChat, texts.moderateAnnounce.acceptedNotify);
                                    bot.sendMessage(match.author.id, format(texts.moderateAnnounce.accepted, TelegramFormatting.formatAnswer(match)), {
                                        parse_mode: "MarkdownV2",
                                    });
                                })
                                .catch(e => bot.sendMessage(match.reviewer, e.stack)));
                    },
                },
                {
                    text: "DECLINE",
                    callback_data: "D",
                    callback() {
                        return prisma.staging.update({
                            where: {
                                id: match.stagingId,
                            },
                            data: {
                                status: "declined",
                                reviewed_by: hasRights(match.reviewer),
                                updated: new Date(),
                            },
                            select: {},
                        })
                            .then(() => {
                                bot.sendMessage(match.reviewingChat, texts.moderateAnnounce.declinedNotify);
                                bot.sendMessage(match.author.id, format(texts.moderateAnnounce.declined, TelegramFormatting.formatAnswer(match)), {
                                    parse_mode: "MarkdownV2",
                                });
                            })
                            .catch(e => bot.sendMessage(match.reviewer, e.stack));
                    },
                },
            ],
            [
                {
                    text: "REQUEST CHANGES",
                    callback_data: "R",
                    callback() {
                        return prisma.staging.update({
                            where: {
                                id: match.stagingId,
                            },
                            data: {
                                status: "request_changes",
                                reviewed_by: hasRights(match.reviewer),
                                updated: new Date(),
                            },
                            select: {},
                        })
                            .then(() => {
                                bot.sendMessage(match.reviewingChat, texts.moderateAnnounce.requestNotify);
                                bot.sendMessage(match.author.id, format(texts.moderateAnnounce.request_changes, TelegramFormatting.formatAnswer(match)), {
                                    parse_mode: "MarkdownV2",
                                });
                            })
                            .catch(e => bot.sendMessage(match.reviewer, e.stack));
                    },
                },
                {
                    text: "SYNONYM",
                    callback_data: "S",
                    callback() {
                        function generateSynonymMarkup(entry: { term: string; value: string; }): TelegramBot.ReplyKeyboardMarkup {
                            const matchedEnters: ReadonlyArray<string> = fuzzySearchWithLen(
                                [entry.term, entry.value], 3,
                            )
                                .filter(value => !!value.value)
                                .map((value: ObscureEntry) => BaseFormatting.formatAnswerUnpreceded(value));

                            return genNStringMarkup(matchedEnters);
                        }

                        const callback: (originEntry: ObscureEntry) => void = (originEntry: ObscureEntry) => {
                            Promise.race([
                                prisma.obscure.update({
                                    where: {
                                        id: originEntry.id,
                                    },
                                    data: {
                                        synonyms: {
                                            push: match.term,
                                        },
                                    },
                                    select: {},
                                }),
                                prisma.staging.update({
                                    where: {
                                        id: match.stagingId,
                                    },
                                    data: {
                                        status: "synonym",
                                        reviewed_by: hasRights(match.reviewer),
                                        accepted_as: originEntry.id,
                                        updated: new Date(),
                                    },
                                    select: {},
                                }),
                            ])
                                .then(() => {
                                    editTerm(originEntry, t => t.synonyms.push(match.term));
                                    bot.sendMessage(match.reviewingChat, texts.moderateAnnounce.synonymNotify, { reply_markup: { remove_keyboard: true } });
                                    bot.sendMessage(match.author.id, format(texts.moderateAnnounce.synonym, TelegramFormatting.formatAnswer(match), TelegramFormatting.formatAnswer(originEntry)), {
                                        parse_mode: "MarkdownV2",
                                    });
                                })
                                .catch(e => console.error(e));
                        };

                        bot.sendMessage(match.reviewingChat, "Select Synonym (must reply)", {
                            reply_markup: generateSynonymMarkup(match),
                            reply_to_message_id: match.msgId,
                        })
                            .then(m => {
                                const listener = bot.onReplyToMessage(m.chat.id, m.message_id, msg => {

                                    if (!msg.text || msg.from?.id !== match.reviewer) {
                                        return;
                                    }
                                    const fuzzy = findAndValidateTerm(msg.text);
                                    if (!fuzzy) {
                                        bot.sendMessage(msg.chat.id, "I didn't find this term. Try to provide over inline-mode");
                                        return;
                                    }
                                    bot.removeReplyListener(listener);
                                    callback(fuzzy);
                                });
                            });
                    },
                },
            ],
        ],
        restrictedTo,
    };
}

export function categorizeMarkup(chatId: number, restrictedTo: number): Keyboard {
    return {
        inline_keyboard: [
            [
                {
                    text: "Create new",
                    callback_data: "CREATE",
                    callback() {
                        bot.sendMessage(chatId, "Reply to this message w/ name of new Category")
                            .then(message => {
                                const listenId = bot.onReplyToMessage(message.chat.id, message.message_id, msg => {
                                    if (msg.from && hasRights(msg.from.id) && msg.text && compiledRegexp.categoryDef.test(msg.text)) {
                                        processCategory(msg.text, msg.from)
                                            .then(ret => bot.sendMessage(chatId, `Successful created new category ${ret}`))
                                            .then(() => bot.removeReplyListener(listenId));
                                    } else {
                                        bot.sendMessage(msg.chat.id, texts.hasNoRights);
                                    }
                                });
                            });
                    },
                },
                {
                    text: "Assign",
                    callback_data: "ASSIGN",
                    callback() {
                        const genCategoryKeyboard = () => prisma.categories.findMany({
                                select: {
                                    value: true,
                                },
                                take: 3,
                            })
                                .then(c => genNStringMarkup(c.map(cat => cat.value))),

                            genObscureKeyboard = () => prisma.obscure.findMany({
                                select: {
                                    id: true,
                                },
                                take: 3,
                            })
                                .then(i => genNStringMarkup(findByIds(i.map(e => e.id))
                                    .filter(e => !!e)
                                    .map(e => BaseFormatting.formatAnswerUnpreceded(<ObscureEntry>e)))),

                            precessLinkage = (providedTerm: ObscureEntry, providedCategory: { id: number }) => prisma.obscure.update({
                                where: {
                                    id: providedTerm.id,
                                },
                                data: {
                                    categories: {
                                        connect: { id: providedCategory.id },
                                    },
                                },
                                select: {},
                            })
                                .then(() => bot.sendMessage(chatId, "Successful linked", { reply_markup: { remove_keyboard: true } }));

                        function processCategoryDefinition(categoryProvidedMsg: TelegramBot.Message, listenId: number, providedTerm: ObscureEntry) {
                            if (categoryProvidedMsg.from && hasRights(categoryProvidedMsg.from.id) && categoryProvidedMsg.text && compiledRegexp.categoryDef.test(categoryProvidedMsg.text)) {
                                return findAndValidateCategory(categoryProvidedMsg.text)
                                    .then(providedCategory => {
                                        if (!providedCategory) {
                                            return bot.sendMessage(chatId, "I didn't find this category");
                                        }
                                        bot.removeReplyListener(listenId);
                                        return precessLinkage(providedTerm, providedCategory);
                                    });
                            } else {
                                return bot.sendMessage(chatId, texts.hasNoRights);
                            }
                        }

                        function requestCategory(providedTerm: ObscureEntry) {
                            return genCategoryKeyboard()
                                .then(categoriesKeyboard => bot.sendMessage(chatId, "Reply to this message w/ category name", {
                                    reply_markup: categoriesKeyboard,
                                })
                                    .then(categoryProvideMsg => {
                                        const listenId = bot.onReplyToMessage(chatId, categoryProvideMsg.message_id, categoryProvidedMsg => processCategoryDefinition(categoryProvidedMsg, listenId, providedTerm));
                                    }));
                        }

                        function processTermDefinition(termProvidedMsg: TelegramBot.Message, listenId: number) {
                            if (termProvidedMsg.from && hasRights(termProvidedMsg.from.id) && termProvidedMsg.text && compiledRegexp.fullMatch.test(termProvidedMsg.text)) {
                                const providedTerm = findAndValidateTerm(termProvidedMsg.text);
                                bot.removeReplyListener(listenId);
                                if (!providedTerm) {
                                    bot.sendMessage(chatId, "I didn't find this term. Try to provide over inline-mode");
                                    return;
                                }
                                return requestCategory(providedTerm);
                            }
                            return bot.sendMessage(chatId, texts.hasNoRights);
                        }

                        function requestTerm(obscureKeyboard: TelegramBot.ReplyKeyboardMarkup) {
                            return bot.sendMessage(chatId, "Reply to this message w/ term. May provide over in-line", {
                                reply_markup: obscureKeyboard,
                            })
                                .then(termProvideMsg => {
                                    const listenId = bot.onReplyToMessage(chatId, termProvideMsg.message_id, termProvidedMsg => processTermDefinition(termProvidedMsg, listenId));
                                });
                        }

                        genObscureKeyboard()
                            .then(obscureKeyboard => requestTerm(obscureKeyboard));
                    },
                },
            ],
        ],
        restrictedTo,
    };
}

export function telemetryMarkup(message: TelegramBot.Message, restrictedTo: number, reset = false): Keyboard {
    function forward(id: number, query: { message: { from?: TelegramBot.User, chat: TelegramBot.Chat, message_id: number } }) {
        collectTelemetry(reset || id < 0 ? undefined : id)
            .then(entry => {
                if (query.message && message.from) {
                    const replyMarkup = telemetryMarkup(message, message.from.id, !entry);
                    bot.editMessageText(entry ? BaseFormatting.formatTelemetry(entry) : texts.telemetryModerate.noWaiting, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        reply_markup: replyMarkup,
                    })
                        .then(e => registerCallback(<TelegramBot.Message>e, replyMarkup));
                } else {
                    bot.sendMessage(message.chat.id, texts.telemetryModerate.noWaiting);
                }
            });
    }

    return {
        inline_keyboard: [
            [
                {
                    text: "➡️",
                    callback_data: "F",
                    callback: query => {
                        if (query.message && query.message.text) {
                            forward(BaseFormatting.grabUsrID(query.message.text), {
                                message: {
                                    from: query.message.from,
                                    chat: query.message.chat,
                                    message_id: query.message.message_id,
                                },
                            });
                        }
                    },
                },
                {
                    text: texts.telemetryModerate.resolved,
                    callback_data: "R",
                    callback: query => {
                        let id;
                        if (query.message && query.message.text && (id = BaseFormatting.grabUsrID(query.message.text)) !== 0) {
                            forward(BaseFormatting.grabUsrID(query.message.text), {
                                message: {
                                    from: query.message.from,
                                    chat: query.message.chat,
                                    message_id: query.message.message_id,
                                },
                            });
                            prisma.telemetry.update({
                                where: {
                                    id,
                                },
                                data: {
                                    moderated_by: hasRights(restrictedTo),
                                    moderated_at: new Date(),
                                },
                                select: {},
                            })
                                .then(() => bot.sendMessage(message.chat.id, texts.success));
                        }
                    },
                },
            ],
        ],
        restrictedTo,
    };
}
