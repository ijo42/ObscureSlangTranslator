import TelegramBot from "node-telegram-bot-api";
import { texts } from "./texts";
import { commands } from "./commands";
import setupFuzzyCache from "./utils/fuzzySearch";
import setupModerateCache from "./utils/moderate";
import setupDrawing from "./utils/drawing";
import { processInline, processQuery } from "./inLineHandler";
import prisma from './db';

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
// @ts-ignore
global.debug = process.env.debug || false;
// Create a bot that uses 'polling' to fetch new updates
export const bot = new TelegramBot(token, {polling: true});

async function main() {
    prisma.$connect();

    await setupFuzzyCache();
    await setupModerateCache();
    await setupDrawing();

    bot.on('new_chat_members', msg => {
        bot.sendMessage(msg.chat.id, texts.welcome);
    });

    bot.on('polling_error', error => {
        console.log(JSON.stringify(error));  // => 'EFATAL'
    });

    bot.on('callback_query', query => {
        if (query.message) processQuery(query);
    });

    bot.on('inline_query', query => processInline(query));

    commands.forEach(command => {
        bot.onText(command.regexp, command.callback);
    });

    await bot.setMyCommands(commands);

    console.log(`Registered ${commands.length} commands`)
    bot.getMe().then(value => {
        if (value.username)
            console.log(`Bot: https://t.me/${value.username}`);
    });

    console.log('Bot setup successful')
}

main()
    .catch(e => {
        bot.stopPolling().then(() => process.exit(1));
        throw e;
    });
