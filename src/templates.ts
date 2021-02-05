import * as tg from "node-telegram-bot-api";

export class Command {
    regexp: RegExp;
    desk: string;
    callback: ((msg: tg.Message, match: RegExpExecArray | null) => void)

    constructor(regexp: RegExp, desk: string, callback: (msg: tg.Message, match: (RegExpExecArray | null)) => void) {
        this.regexp = regexp;
        this.desk = desk;
        this.callback = callback;
    }
}

export class ObscureEntry {
    term: string;
    value: string;
    synonyms: string[];

    constructor(term: string, value: string) {
        this.term = term;
        this.value = value;
        this.synonyms = [];
    }
}

interface KeyboardButton extends tg.InlineKeyboardButton {
    text: string;
    url?: string;
    login_url?: tg.LoginUrl;
    callback_data?: string;
    switch_inline_query?: string;
    switch_inline_query_current_chat?: string;
    callback_game?: tg.CallbackGame;
    pay?: boolean;
    callback: (query: tg.CallbackQuery) => void;
}

export interface Keyboard extends tg.InlineKeyboardMarkup {
    inline_keyboard: KeyboardButton[][];
}

module.exports = {
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