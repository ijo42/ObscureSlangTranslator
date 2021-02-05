import TelegramBot, { Message } from "node-telegram-bot-api";

export class Command {
    regexp: RegExp;
    desk: string;
    callback: ((msg: TelegramBot.Message, match: RegExpExecArray | null) => void)

    constructor(regexp: RegExp, desk: string, callback: (msg: Message, match: (RegExpExecArray | null)) => void) {
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