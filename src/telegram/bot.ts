import { texts } from "../texts";
import setupModerateCache, { hasRights } from "./moderate";
import { commands, defaultCommand } from "./commands";
import TelegramBot from "node-telegram-bot-api";
import { Keyboard } from "./templates";
import { fuzzySearchWithLen } from "../utils/fuzzySearch";
import { randomInt } from "crypto";
import { TelegramFormatting } from "../utils/formatting";
import { Metrics } from "../metrics";

const token = process.env.TELEGRAM_TOKEN || "YOUR_TELEGRAM_BOT_TOKEN",
    url = process.env.APP_URL;
export const bot = new TelegramBot(token, {
    polling: url === undefined,
    webHook: url ? {
        port: Number(process.env.PORT),
    } : undefined,
});

export default async function app(): Promise<void> {
    await setupModerateCache();

    bot.on("new_chat_members", msg => {
        bot.sendMessage(msg.chat.id, texts.welcome);
    });

    bot.on(url ? "webhook_error" : "polling_error", error => {
        console.log(JSON.stringify(error));  // => 'EFATAL'
    });

    bot.on("callback_query", query => {
        if (query.message) {
            processQuery(query);
        }
    });

    bot.on("inline_query", query => processInline(query));

    commands.forEach(command => {
        bot.onText(command.regexp, command.callback);
    });

    bot.onText(defaultCommand.regexp, defaultCommand.callback);

    await bot.setMyCommands(commands);

    console.log(`Registered ${commands.length} commands`);
    bot.getMe()
        .then(value => {
            if (value.username) {
                console.log(`Bot: https://t.me/${value.username}`);
            }
        });
    if(!bot.isPolling()) {
        await bot.setWebHook(`${url}/bot${token}`);
    }
    console.log("Bot setup successful");
}

export function terminate(): Promise<void> {
    if(bot.isPolling()) {
        return bot.stopPolling();
    } else {
        return Promise.resolve();
    }
}

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
                } catch (e: any) {
                    bot.sendMessage(query.from.id, e);
                }
            }
        }
    }
};

export function processInline(query: TelegramBot.InlineQuery): void {
    Metrics.inlineRequests.inc();
    bot.answerInlineQuery(query.id, fuzzySearchWithLen([query.query], 15)
        .map(value => <TelegramBot.InlineQueryResultArticle>{
            type: "article",
            id: randomInt(10000)
                .toString(),
            title: value.term,
            input_message_content: <TelegramBot.InputTextMessageContent>{
                message_text: TelegramFormatting.formatAnswer(value),
                parse_mode: "MarkdownV2",
            },
        }));
}
