import TelegramBot from "node-telegram-bot-api";
import { texts } from "./texts";
import { commands } from "./commands";
import setupFuzzyCache from "./utils/fuzzySearch";
import setupModerateCache from "./utils/moderate";
import { processQuery } from "./inLineHandler";

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
// @ts-ignore
global.debug = process.env.debug || false;
// Create a bot that uses 'polling' to fetch new updates
export const bot = new TelegramBot(token, {polling: true});

setupFuzzyCache().then(() => setupModerateCache()).then(() => {
    console.log('Bot setup successful');

    bot.on('new_chat_members', msg => {
        bot.sendMessage(msg.chat.id, texts.welcome);
    });

    bot.on('polling_error', error => {
        console.log(JSON.stringify(error));  // => 'EFATAL'
    });

    bot.on('callback_query', query => {
        if (query.message) processQuery(query);
    });

    commands.forEach(command => {
        bot.onText(command.regexp, command.callback);
    });
    bot.setMyCommands(commands);

    console.log(`Registered ${commands.length} commands`)
});
