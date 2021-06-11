import TelegramBot from "node-telegram-bot-api";
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
import { hasRights } from "./moderate";
import { compiledRegexp } from "../utils/regexpBuilder";
import {
    CategoryInteraction,
    TelegramInteraction,
    TelemetryInteraction,
    TermInteraction,
} from "../db/interaction";
import { bot, registerCallback } from "./bot";
import { obscure } from "@prisma/client";

export interface Command extends TelegramBot.BotCommand {
    regexp: RegExp;
    command: string;
    description: string;
    callback: ((msg: TelegramBot.Message, match: RegExpExecArray | null) => void)
}

export interface ModerateAction extends obscure {
    stagingId: number;
    author: TelegramInteraction.User;
    reviewer: TelegramInteraction.User;
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

export async function processReplenishment(entry: obscure, author: TelegramInteraction.User, staging = true): Promise<obscure> {
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

export function moderateMarkup(action: ModerateAction, restrictedTo: number | boolean = false): Keyboard {
    return {
        inline_keyboard: [
            [
                {
                    text: "ACCEPT",
                    callback_data: "A",
                    callback() {
                        processReplenishment(action, action.author, false)
                            .then(acceptedAs => TelegramInteraction.moderateAction(action, "accepted", acceptedAs)
                                .then(() => {
                                    bot.sendMessage(action.reviewingChat, texts.moderateAnnounce.acceptedNotify);
                                    bot.sendMessage(action.author.id, format(texts.moderateAnnounce.accepted,
                                        TelegramFormatting.formatAnswer(action)), {
                                        parse_mode: "MarkdownV2",
                                    });
                                }))
                            .catch(e => bot.sendMessage(action.reviewer.id, e.message));
                    },
                },
                {
                    text: "DECLINE",
                    callback_data: "D",
                    callback() {
                        TelegramInteraction.moderateAction(action, "declined")
                            .then(() => {
                                bot.sendMessage(action.reviewingChat, texts.moderateAnnounce.declinedNotify);
                                bot.sendMessage(action.author.id, format(texts.moderateAnnounce.declined, TelegramFormatting.formatAnswer(action)), {
                                    parse_mode: "MarkdownV2",
                                });
                            })
                            .catch(e => bot.sendMessage(action.reviewer.id, e.message));
                    },
                },
            ],
            [
                {
                    text: "REQUEST CHANGES",
                    callback_data: "R",
                    callback() {
                        TelegramInteraction.moderateAction(action, "request_changes")
                            .then(() => {
                                bot.sendMessage(action.reviewingChat, texts.moderateAnnounce.requestNotify);
                                bot.sendMessage(action.author.id, format(texts.moderateAnnounce.request_changes, TelegramFormatting.formatAnswer(action)), {
                                    parse_mode: "MarkdownV2",
                                });
                            })
                            .catch(e => bot.sendMessage(action.reviewer.id, e.message));
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
                                .map((value: obscure) => BaseFormatting.formatAnswerUnpreceded(value));

                            return genNStringMarkup(matchedEnters);
                        }

                        function callback(originEntry: obscure) {
                            Promise.all([
                                TermInteraction.pushSynonym(originEntry, action),
                                TelegramInteraction.moderateAction(action, "synonym", originEntry),
                            ])
                                .then(() => {
                                    editTerm(originEntry, t => t.synonyms.push(action.term));
                                    bot.sendMessage(action.reviewingChat, texts.moderateAnnounce.synonymNotify, { reply_markup: { remove_keyboard: true } });
                                    bot.sendMessage(action.author.id, format(texts.moderateAnnounce.synonym, TelegramFormatting.formatAnswer(action), TelegramFormatting.formatAnswer(originEntry)), {
                                        parse_mode: "MarkdownV2",
                                    });
                                })
                                .catch(e => bot.sendMessage(action.reviewer.id, e.message));
                        }

                        bot.sendMessage(action.reviewingChat, "Select Synonym (must reply)", {
                            reply_markup: generateSynonymMarkup(action),
                            reply_to_message_id: action.msgId,
                        })
                            .then(m => {
                                const listener = bot.onReplyToMessage(m.chat.id, m.message_id, msg => {

                                    if (!msg.text || msg.from?.id !== action.reviewer.id) {
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
                                const listenId = bot.onReplyToMessage(chatId, message.message_id, msg => {
                                    if (msg.from && hasRights(msg.from.id) && msg.text && compiledRegexp.categoryDef.test(msg.text)) {
                                        TelegramInteraction.createCategory(msg.text, msg.from)
                                            .then(ret => bot.sendMessage(chatId, `Successful created new category ${ret.value}`))
                                            .then(() => bot.removeReplyListener(listenId));
                                    } else {
                                        bot.sendMessage(chatId, texts.hasNoRights);
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
                                    .map(e => BaseFormatting.formatAnswerUnpreceded(<obscure>e))));

                        function processCategoryDefinition(categoryProvidedMsg: TelegramBot.Message, listenId: number, providedTerm: obscure) {
                            if (categoryProvidedMsg.from && hasRights(categoryProvidedMsg.from.id) && categoryProvidedMsg.text && compiledRegexp.categoryDef.test(categoryProvidedMsg.text)) {
                                findAndValidateCategory(categoryProvidedMsg.text)
                                    ?.then(providedCategory => {
                                        if (!providedCategory) {
                                            bot.sendMessage(chatId, "I didn't find this category");

                                        } else {
                                            bot.removeReplyListener(listenId);
                                            CategoryInteraction.linkTerm(providedTerm, providedCategory)
                                                .then(() => bot.sendMessage(chatId, "Successful linked", { reply_markup: { remove_keyboard: true } }));
                                        }
                                    });
                            } else {
                                bot.sendMessage(chatId, texts.hasNoRights);
                            }
                        }

                        function requestCategory(providedTerm: obscure) {
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
                            bot.sendMessage(chatId, "Reply to this message w/ term. May provide over in-line", {
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

export function telemetryMarkup(originMessage: TelegramBot.Message, restrictedTo: number, reset = false): Keyboard {
    function forward(id: number, message: TelegramBot.Message) {
        TelemetryInteraction.collectTelemetry(reset || id < 0 ? undefined : id)
            .then(entry => {
                if (message && originMessage.from) {
                    const replyMarkup = telemetryMarkup(originMessage, originMessage.from.id, !entry);
                    bot.editMessageText(entry ? BaseFormatting.formatTelemetry(entry) : texts.telemetryModerate.noWaiting, {
                        chat_id: message.chat.id,
                        message_id: message.message_id,
                        reply_markup: replyMarkup,
                    })
                        .then(e => {
                            if (typeof e !== "boolean") {
                                registerCallback(e, replyMarkup);
                            }
                        });
                } else {
                    bot.sendMessage(originMessage.chat.id, texts.telemetryModerate.noWaiting);
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
                            forward(BaseFormatting.grabUsrID(query.message.text), query.message);
                        }
                    },
                },
                {
                    text: texts.telemetryModerate.resolved,
                    callback_data: "R",
                    callback: query => {
                        let id;
                        if (query.message && query.message.text && (id = BaseFormatting.grabUsrID(query.message.text)) !== 0) {
                            forward(BaseFormatting.grabUsrID(query.message.text), query.message);
                            TelegramInteraction.markReportResolved(id, query.from)
                                .then(() => bot.sendMessage(originMessage.chat.id, texts.success));
                        }
                    },
                },
            ],
        ],
        restrictedTo,
    };
}
