import { CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message } from "node-telegram-bot-api";
import { bot } from "./app";

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
    moderateMarkup: function (_vars: string[]): Keyboard {
        return {
            inline_keyboard: [
                [
                    {
                        text: 'ACCEPT',
                        callback_data: 'A',
                        callback: () => {
                        }
                    },
                    {
                        text: 'DECLINE',
                        callback_data: 'D',
                        callback: () => {
                        }
                    }
                ],
                [
                    {
                        text: 'REQUEST CHANGES',
                        callback_data: 'R',
                        callback: () => {
                        }
                    },
                    {
                        text: 'SYNONYM',
                        callback_data: 'S',
                        callback: () => {
                        }
                    }
                ]
            ]
        }
    }
}