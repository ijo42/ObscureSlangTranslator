import TelegramBot, {
    CallbackQuery,
    InlineQueryResultArticle,
    InputTextMessageContent,
    Message
} from "node-telegram-bot-api";
import { Keyboard } from "./templates";
import { hasRights } from "./utils/moderate";
import { fuzzySearchWithLen } from "./utils/fuzzySearch";
import { randomInt } from "crypto";
import { formatAnswer } from "./utils/formatting";
import { bot } from "./app";

const registeredCallbacks = new Map<number, Keyboard>();

export const registerCallback = (message: Message, callback: Keyboard) => {
    registeredCallbacks.set(message.message_id, callback);
};

export const processQuery = (query: CallbackQuery) => {
    if (query.message && "reply_markup" in query.message) {
        const possibleKeyboard = registeredCallbacks.get(query.message.message_id);
        if (possibleKeyboard)
            for (const columns of possibleKeyboard.inline_keyboard)
                columns.find(val =>
                    val.callback_data == query.data &&
                    (!possibleKeyboard.restrictedTo || possibleKeyboard.restrictedTo === query.from.id ||
                        (possibleKeyboard.restrictedTo === true && hasRights(query.from.id))))?.callback(query)
                    .then(() =>
                        registeredCallbacks.delete(query.message?.message_id || -1))
                    .then(() => bot.answerCallbackQuery(query.id))
                    .catch(e => bot.sendMessage(query.from.id, e.stack));
    }
}

export const processInline = (query: TelegramBot.InlineQuery) => bot.answerInlineQuery(query.id, fuzzySearchWithLen([query.query], 50).map(value => <InlineQueryResultArticle>{
    type: 'article',
    id: randomInt(10000).toString(),
    title: value.term,
    input_message_content: <InputTextMessageContent>{
        message_text: formatAnswer(value),
        parse_mode: "MarkdownV2"
    }
}));