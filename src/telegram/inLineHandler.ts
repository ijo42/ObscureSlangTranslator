import TelegramBot from "node-telegram-bot-api";
import { hasRights } from "../utils/moderate";
import { fuzzySearchWithLen } from "../utils/fuzzySearch";
import { randomInt } from "crypto";
import { bot } from "../app";
import { Keyboard } from "./templates";
import { TelegramFormatting } from "../utils/formatting";

const registeredCallbacks = new Map<number, Keyboard>();

export const registerCallback: (message: TelegramBot.Message, callback: Keyboard) => void = (message: TelegramBot.Message, callback: Keyboard) => {
    registeredCallbacks.set(message.message_id, callback);
};

export const processQuery: (query: TelegramBot.CallbackQuery) => void = (query: TelegramBot.CallbackQuery) => {
    function restrictedKeyboardChecks(possibleKeyboard: Keyboard) {
        return !possibleKeyboard.restrictedTo || possibleKeyboard.restrictedTo === query.from.id ||
            possibleKeyboard.restrictedTo === true && hasRights(query.from.id);
    }

    if (query.message && "reply_markup" in query.message) {
        const possibleKeyboard = registeredCallbacks.get(query.message.message_id);
        if (possibleKeyboard) {
            for (const columns of possibleKeyboard.inline_keyboard) {
                try {
                    const entry = columns.find(val => val.callback_data === query.data &&
                        restrictedKeyboardChecks(possibleKeyboard));
                    if (entry) {
                        entry.callback(query);
                        registeredCallbacks.delete(query.message.message_id);
                        bot.answerCallbackQuery(query.id);
                    }
                } catch (e) {
                    bot.sendMessage(query.from.id, e.stack);
                }
            }
        }
    }
};

export function processInline(query: TelegramBot.InlineQuery): void {
    bot.answerInlineQuery(query.id, fuzzySearchWithLen([query.query], 15).map(value => <TelegramBot.InlineQueryResultArticle>{
        type: "article",
        id: randomInt(10000).toString(),
        title: value.term,
        input_message_content: <TelegramBot.InputTextMessageContent>{
            message_text: TelegramFormatting.formatAnswer(value),
            parse_mode: "MarkdownV2",
        },
    }));
}
