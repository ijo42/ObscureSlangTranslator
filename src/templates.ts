import { CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message } from "node-telegram-bot-api";
import { bot } from "./app";
import { queries } from "./db/patterns";
import { QueryResult } from "pg";
import { fuse } from "./utils/fuzzySearch";
import { formatAnswer, grabUsrID } from "./utils/formatting";
import { texts } from "./texts";
import { format } from "util";

const db = require("./db");

export const StagingStatus = {
    WAITING: 'waiting',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    REQUEST_CHANGES: 'request_changes',
    SYNONYM: 'synonym'
}

export interface Command {
    regexp: RegExp;
    desk: string;
    callback: ((msg: Message, match: RegExpExecArray | null) => void)
}

export interface ObscureEntry {
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
    callback: (query: CallbackQuery) => void;
}

export interface Keyboard extends InlineKeyboardMarkup {
    inline_keyboard: KeyboardButton[][];
}

module.exports = {
    forceUpload: function (onForce: () => void): Keyboard {
        return {
            inline_keyboard: [
                [{
                    text: 'Force', callback_data: 'F',
                    callback: (query) => {
                        onForce();
                        bot.answerCallbackQuery(query.id);
                    }
                }]
            ]
        }

    },
    moderateMarkup: function (match: ModerateAction): Keyboard {
        return {
            inline_keyboard: [
                [
                    {
                        text: 'ACCEPT',
                        callback_data: 'A',
                        callback: () => {
                            db.query(queries.insertTerm, [match.term, match.value, match.author]).then((res: QueryResult) => {
                                fuse.add(match);

                                if (!res.rows[0])
                                    console.error(`res.rows[0] is null: ${JSON.stringify(res)}`);

                                db.query(queries.updateStaging, [StagingStatus.ACCEPTED, match.reviewer, res.rows[0].id, match.stagingId]).then(() => {
                                    bot.sendMessage(match.reviewer, "Successful accepted");
                                    bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.accepted, formatAnswer(match)));
                                }).catch((e: any) =>
                                    bot.sendMessage(match.reviewer, e.stack));

                            }).catch((e: any) => console.error(e.stack));
                        }
                    },
                    {
                        text: 'DECLINE',
                        callback_data: 'D',
                        callback: () => {
                            db.query(queries.updateStaging, [StagingStatus.DECLINED, match.reviewer, -1, match.stagingId]).then(() => {
                                bot.sendMessage(match.reviewer, "Successful declined");
                                bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.declined, formatAnswer(match)));
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
                            db.query(queries.updateStaging, [StagingStatus.REQUEST_CHANGES, match.reviewer, -1, match.stagingId]).then(() => {
                                bot.sendMessage(match.reviewer, "Successful requested");
                                bot.sendMessage(grabUsrID(match.author), format(texts.moderateAnnounce.request_changes, formatAnswer(match)));
                            }).catch((e: any) =>
                                bot.sendMessage(match.reviewer, e.stack));
                        }
                    },
                    {
                        text: 'SYNONYM',
                        callback_data: 'S',
                        callback: () => {
                            bot.sendMessage(match.reviewer, "Not yet implemented");
                        }
                    }
                ]
            ]
        }
    }
}