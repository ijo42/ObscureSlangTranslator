import { BotCommand, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message } from "node-telegram-bot-api";
import { bot } from "./app";
import { editTerm, fuzzySearchWithLen, pushTerm } from "./utils/fuzzySearch";
import { formatAnswer, formatAnswerUnpreceded, grabUsrID } from "./utils/formatting";
import { texts } from "./texts";
import { format } from "util";
import { registerCallback } from "./inLineHandler";
import prisma from "./db";

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

export function synonymMarkup(s: string[], run: ((s: number) => void), restrictedTo: number | boolean = false): Keyboard {
    let keyboard: Keyboard = {
        inline_keyboard: [[], [], []],
        restrictedTo: restrictedTo
    };
    for (let i = 0; i < s.length; i++) {
        if (!s[i])
            continue;

        keyboard.inline_keyboard[i]?.push({
            text: <string>s[i],
            callback_data: `S${i}`,
            callback: () => Promise.resolve(run(i))
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
                        const matchedEnters: ObscureEntry[] = fuzzySearchWithLen([match.term, match.value], 3).filter(value => value.value != undefined);
                        const possibleEnters = matchedEnters.map((value: ObscureEntry) => formatAnswerUnpreceded(value));

                        const replyMarkup = synonymMarkup(possibleEnters, (entryID: number) => {
                            const matched = matchedEnters[entryID];
                            if (!matched || !matched.id) {
                                console.log(`undefined synonym on ${entryID}, ${JSON.stringify(matchedEnters)}`);
                                return;
                            }

                            // to resolve https://github.com/prisma/prisma/issues/5078
                            return prisma.$executeRaw`UPDATE obscure SET synonyms = array_prepend(${match.term}, synonyms) WHERE id = ${matched.id}`
                                .then(() => {
                                    prisma.staging.update({
                                        where: {
                                            id: match.stagingId
                                        },
                                        data: {
                                            status: "synonym",
                                            reviewed_by: match.reviewer,
                                            accepted_as: matched.id,
                                            updated: new Date()
                                        }
                                    }).then(() => {
                                        editTerm(matched, (t => t.synonyms.push(match.term)));
                                        bot.sendMessage(match.reviewingChat, "Successful marked as Synonym");
                                        return bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.synonym, formatAnswer(match), formatAnswer(matched)), {
                                            parse_mode: "MarkdownV2"
                                        });
                                    }).catch(e => console.error(e));
                                }).catch(e => console.error(e))
                        }, match.reviewer);

                        return bot.sendMessage(match.reviewingChat, "Select Synonym", {
                            reply_markup: replyMarkup
                        }).then(value => registerCallback(value, replyMarkup));
                    }
                }
            ]
        ],
        restrictedTo: restrictedTo
    }
}