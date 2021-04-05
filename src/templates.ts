import {
    BotCommand,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    ReplyKeyboardMarkup,
} from "node-telegram-bot-api";
import { bot } from "./app";
import {
    editTerm,
    findAndValidateCategory,
    findAndValidateTerm,
    findByIds,
    fuzzySearchWithLen,
    pushTerm
} from "./utils/fuzzySearch";
import { formatAnswer, formatAnswerUnpreceded, grabUsrID, reformatStr } from "./utils/formatting";
import { texts } from "./texts";
import { format } from "util";
import prisma from "./db";
import { hasRights } from "./utils/moderate";
import { compiledRegexp } from "./utils/regexpBuilder";

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

async function processCategory(msg: string, author: number): Promise<string> {
    return await prisma.categories.create({
        data: {
            value: reformatStr(msg),
            author: author
        },
        select: {
            value: true
        }
    }).then(r => r.value);
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

function genNStringMarkup(matchedEnters: ReadonlyArray<String>): ReplyKeyboardMarkup {
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
                                bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.accepted, formatAnswer(match)), {
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
                            bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.declined, formatAnswer(match)), {
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
                            bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.request_changes, formatAnswer(match)), {
                                parse_mode: "MarkdownV2"
                            });
                        }).catch((e: any) =>
                            bot.sendMessage(match.reviewer, e.stack))
                },
                {
                    text: 'SYNONYM',
                    callback_data: 'S',
                    callback: () => {
                        function generateSynonymMarkup(entry: { term: string; value: string; }): ReplyKeyboardMarkup {
                            const matchedEnters: ReadonlyArray<String> = fuzzySearchWithLen(
                                [entry.term, entry.value], 3)
                                .filter(value => !!value.value)
                                .map((value: ObscureEntry) =>
                                    formatAnswerUnpreceded(value));

                            return genNStringMarkup(matchedEnters);
                        }

                        const callback: (originEntry: ObscureEntry) => void = (originEntry: ObscureEntry) =>
                            prisma.obscure.update({
                                where: {
                                    id: originEntry.id
                                },
                                data: {
                                    synonyms: {
                                        push: match.term,
                                    },
                                },
                            }).then(() => {
                                prisma.staging.update({
                                    where: {
                                        id: match.stagingId
                                    },
                                    data: {
                                        status: "synonym",
                                        reviewed_by: match.reviewer,
                                        accepted_as: originEntry.id,
                                        updated: new Date()
                                    }
                                }).then(() => {
                                    editTerm(originEntry, (t => t.synonyms.push(match.term)));
                                    bot.sendMessage(match.reviewingChat, "Successful marked as Synonym");
                                    bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.synonym, formatAnswer(match), formatAnswer(originEntry)), {
                                        parse_mode: "MarkdownV2"
                                    });
                                }).catch(e => console.error(e));
                            }).catch(e => console.error(e));

                        return bot.sendMessage(match.reviewingChat, "Select Synonym (must reply)", {
                            reply_markup: generateSynonymMarkup(match),
                            reply_to_message_id: match.msgId
                        }).then(m => {
                            const listener = bot.onReplyToMessage(m.chat.id, m.message_id, msg => {

                                if (!msg.text || msg.from?.id != match.reviewer)
                                    return;
                                const fuzzy = findAndValidateTerm(msg.text, msg.chat.id);
                                if (fuzzy) {
                                    bot.removeReplyListener(listener);
                                    callback(fuzzy);
                                }
                            })
                        });
                    }
                }
            ]
        ],
        restrictedTo: restrictedTo
    }
}

export function categorizeMarkup(chatId: number, restrictedTo: number): Keyboard {
    return {
        inline_keyboard: [
            [
                {
                    text: 'Create new',
                    callback_data: 'CREATE',
                    callback: () =>
                        bot.sendMessage(chatId, "Reply to this message w/ name of new Category").then(message => {
                            const listenId = bot.onReplyToMessage(message.chat.id, message.message_id, msg => {
                                if (msg.from && hasRights(msg.from.id) && msg.text && compiledRegexp.categoryDef.test(msg.text)) {
                                    processCategory(msg.text, msg.from.id).then(ret =>
                                        bot.sendMessage(chatId, `Successful created new category ${ret}`)
                                    ).then(() => bot.removeReplyListener(listenId));
                                } else
                                    bot.sendMessage(msg.chat.id, texts.hasNoRights);
                            });
                        })
                },
                {
                    text: 'Assign',
                    callback_data: 'ASSIGN',
                    callback: async () => {
                        let categoriesKeyboard!: ReplyKeyboardMarkup;
                        let obscureKeyboard!: ReplyKeyboardMarkup;

                        prisma.categories.findMany({
                            select: {
                                value: true
                            },
                            take: 3
                        }).then(c => {
                            categoriesKeyboard = genNStringMarkup(c.map(cat => cat.value));
                        });

                        await prisma.obscure.findMany({
                            where: {
                                categories: undefined
                            },
                            select: {
                                id: true
                            },
                            take: 3
                        }).then(i =>
                            obscureKeyboard = genNStringMarkup(findByIds(i.map(e => e.id))
                                .filter(e => !!e)
                                .map(e => formatAnswerUnpreceded(<ObscureEntry>e))))


                        return bot.sendMessage(chatId, "Reply to this message w/ term. May provide over in-line", {
                            reply_markup: obscureKeyboard
                        }).then(termProvideMsg => {
                            const listenId = bot.onReplyToMessage(termProvideMsg.chat.id, termProvideMsg.message_id, termProvidedMsg => {
                                if (termProvidedMsg.from && hasRights(termProvidedMsg.from.id) && termProvidedMsg.text && compiledRegexp.fullMatch.test(termProvidedMsg.text)) {
                                    const providedTerm = findAndValidateTerm(termProvidedMsg.text, termProvidedMsg.chat.id);
                                    bot.removeReplyListener(listenId)
                                    if (!providedTerm)
                                        return;
                                    return bot.sendMessage(chatId, "Reply to this message w/ category name", {
                                        reply_markup: categoriesKeyboard
                                    }).then(categoryProvideMsg => {
                                        const listenId = bot.onReplyToMessage(categoryProvideMsg.chat.id, categoryProvideMsg.message_id, categoryProvidedMsg => {
                                            if (categoryProvidedMsg.from && hasRights(categoryProvidedMsg.from.id) && categoryProvidedMsg.text && compiledRegexp.categoryDef.test(categoryProvidedMsg.text)) {
                                                return findAndValidateCategory(categoryProvidedMsg.text).then(providedCategory => {
                                                    if (!providedCategory) {
                                                        bot.sendMessage(chatId, "I didn't find this category");
                                                        return;
                                                    }
                                                    bot.removeReplyListener(listenId)
                                                    return prisma.obscure.update({
                                                        where: {
                                                            id: providedTerm.id
                                                        },
                                                        data: {
                                                            categories: {
                                                                connect: {id: providedCategory.id}
                                                            }
                                                        }
                                                    })
                                                }).then(() => bot.sendMessage(categoryProvidedMsg.chat.id, "Successful linked"));
                                            } else
                                                return bot.sendMessage(categoryProvideMsg.chat.id, texts.hasNoRights);
                                        });
                                    });
                                } else
                                    return bot.sendMessage(termProvidedMsg.chat.id, texts.hasNoRights);
                            });
                        });
                    }
                },
            ]
        ],
        restrictedTo: restrictedTo
    }
}