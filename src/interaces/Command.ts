import TelegramBot from "node-telegram-bot-api";

export class Command {
    regexp: RegExp;
    desk: string;
    callback: ((msg: TelegramBot.Message, match: RegExpExecArray | null) => void)

    constructor(regexp: RegExp, desk: string, callback: (msg: TelegramBot.Message, match: (RegExpExecArray | null)) => void) {
        this.regexp = regexp;
        this.desk = desk;
        this.callback = callback;
    }
}