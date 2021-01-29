import TelegramBot from "node-telegram-bot-api";
import {QueryResult} from "pg";
import {queries} from "./db/paterns";
import {texts} from "./texts";
import {Command} from "./interaces/command";

const db = require("./db");
const util = require("util");

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
// @ts-ignore
global.debug = process.env.debug || false;
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

let commands = new Map<string, Command>([
    ["size", new Command(/\/size$/, 'Get last DB index',
        (msg => {
            const chatId = msg.chat.id;
            db.query(queries.lastIndex).then((res: QueryResult) => {
                const reElement = res.rows[0];
                if (reElement)
                    bot.sendMessage(chatId, util.format(texts.dbSize, reElement['max']));
                else
                    console.error("res.rows[0] is null: ", JSON.stringify(res));
            })
        }))]
]);

commands.forEach(command => {
    bot.onText(command.regexp, command.callback);
})

bot.on('new_chat_members', (msg) => {
    bot.sendMessage(msg.chat.id, texts.welcome);
})

bot.on('polling_error', (error) => {
    console.log(JSON.stringify(error));  // => 'EFATAL'
});
