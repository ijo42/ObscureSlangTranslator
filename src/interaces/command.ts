import TelegramBot from "node-telegram-bot-api";

export class Command {
    constructor(regexp: RegExp, desk: string, callback: (msg: TelegramBot.Message, match: (RegExpExecArray | null)) => void) {
        this.regexp = regexp;
        this.desk = desk;
        this.callback = callback;
    }
    regexp: RegExp;
    desk: string;
    callback: ((msg: TelegramBot.Message, match: RegExpExecArray | null) => void)
}