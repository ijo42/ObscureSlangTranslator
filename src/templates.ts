import { BotCommand, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message } from "node-telegram-bot-api";
import { bot } from "./app";
import { queries } from "./db/patterns";
import { QueryResult } from "pg";
import { fuse, fuzzySearchWithLen } from "./utils/fuzzySearch";
import { formatAnswer, formatAnswerUnpreceded, grabUsrID } from "./utils/formatting";
import { texts } from "./texts";
import { format } from "util";
import { registerCallback } from "./inLineHandler";

const db = require("./db");

export const StagingStatus = {
    WAITING: 'waiting',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    REQUEST_CHANGES: 'request_changes',
    SYNONYM: 'synonym'
}

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
}

interface KeyboardButton extends InlineKeyboardButton {
    callback: (query: CallbackQuery) => Promise<any>;
}

export interface Keyboard extends InlineKeyboardMarkup {
    inline_keyboard: KeyboardButton[][];
    restrictedTo: number | boolean;
}

export function processReplenishment(entry: ObscureEntry, author: string, staging: boolean = true): Promise<QueryResult> {
    return db.query(staging ? queries.insertStg : queries.insertTerm, [entry.term, entry.value, author]).then((res: QueryResult) => {
        entry.id = res.rows[0].id
        if (!staging)
            fuse.add(entry);
        return Promise.resolve(res);
    }).catch((e: any) => console.error(e.stack));
}

export function keyboardWithConfirmation(onForce: () => void, text: string, restrictedTo: number | boolean = false): Keyboard {
    return {
        inline_keyboard: [
            [{
                text: text, callback_data: 'F',
                callback: (query) => {
                    onForce();
                    return bot.answerCallbackQuery(query.id)
                }
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
                        return processReplenishment(match, match.author, false).then((res: QueryResult) => {
                            return db.query(queries.updateStaging, [StagingStatus.ACCEPTED, match.reviewer, res.rows[0].id, match.stagingId]).then(() => {
                                bot.sendMessage(match.reviewer, "Successful accepted");
                                bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.accepted, formatAnswer(match)), {
                                    parse_mode: "MarkdownV2"
                                });
                            }).catch((e: any) =>
                                bot.sendMessage(match.reviewer, e.stack));
                        })
                    }
                },
                {
                    text: 'DECLINE',
                    callback_data: 'D',
                    callback: () => {
                        return db.query(queries.updateStaging, [StagingStatus.DECLINED, match.reviewer, -1, match.stagingId]).then(() => {
                            bot.sendMessage(match.reviewer, "Successful declined");
                            bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.declined, formatAnswer(match)), {
                                parse_mode: "MarkdownV2"
                            });
                        }).catch((e: any) =>
                            bot.sendMessage(match.reviewer, e.stack));
                    }
                }
            ],
            [
                {
                    text: 'REQUEST CHANGES',
                    callback_data: 'R',
                    callback: () => {
                        return db.query(queries.updateStaging, [StagingStatus.REQUEST_CHANGES, match.reviewer, -1, match.stagingId]).then(() => {
                            bot.sendMessage(match.reviewer, "Successful requested");
                            bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.request_changes, formatAnswer(match)), {
                                parse_mode: "MarkdownV2"
                            });
                        }).catch((e: any) =>
                            bot.sendMessage(match.reviewer, e.stack));
                    }
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
                            db.query(queries.insertSynonym, [match.term, matched.id]).then(() => {
                                db.query(queries.updateStaging, [StagingStatus.SYNONYM, match.reviewer, matched.id, match.stagingId]).then(() => {
                                    fuse.remove((doc: ObscureEntry) => matched == doc)
                                    matched.synonyms.push(match.term);
                                    fuse.add(matched);

                                    bot.sendMessage(match.reviewer, "Successful marked as Synonym");
                                    bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.synonym, formatAnswer(match), formatAnswer(matched)), {
                                        parse_mode: "MarkdownV2"
                                    });
                                }).catch((e: any) =>
                                    bot.sendMessage(match.reviewer, e.stack));
                            }).catch((e: any) =>
                                bot.sendMessage(match.reviewer, e.stack));
                        }, match.reviewer);

                        bot.sendMessage(match.reviewer, "Select Synonym", {
                            reply_markup: replyMarkup
                        }).then(value => registerCallback(value, replyMarkup));
                    }
                }
            ]
        ],
        restrictedTo: restrictedTo
    }
}