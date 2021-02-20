import TelegramBot, { BotCommand } from "node-telegram-bot-api";
import { texts } from "./texts";
import { commands } from "./commands";
import setupCache from "./utils/fuzzySearch";
import { processQuery } from "./inLineHandler";
import { Command } from "./templates";

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
// @ts-ignore
global.debug = process.env.debug || false;
// Create a bot that uses 'polling' to fetch new updates
export const bot = new TelegramBot(token, {polling: true});
setupCache();

console.log('Bot setup successful');

commands.forEach(command => {
    bot.onText(command.regexp, command.callback);
})
const botCommands: BotCommand[] = [];
commands.forEach((value: Command, key: string) =>
    botCommands.push({
        command: key,
        description: value.desk
    }));
bot.setMyCommands(botCommands);

bot.on('new_chat_members', (msg) => {
    bot.sendMessage(msg.chat.id, texts.welcome);
})

bot.on('polling_error', (error) => {
    console.log(JSON.stringify(error));  // => 'EFATAL'
});

bot.on('callback_query', query => {
    if (query.message) processQuery(query);
})
