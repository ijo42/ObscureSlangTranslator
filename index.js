const TelegramBot = require('node-telegram-bot-api');
const db = require("./db");
const util = require("util");

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
global.debug = process.env.debug || false;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

const queryInsert = 'INSERT INTO obscure(term, value, author) VALUES($1, $2, $3) RETURNING *';
const querySize = 'SELECT max(id) FROM obscure';
const dbSizeText = 'Currently, DB contains %s terms';
const welcomeText = 'Welcome, available commands: /size'

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const resp = match[1];

    bot.sendMessage(chatId, resp);
});

bot.onText(/\/size$/, (msg) => {
    const chatId = msg.chat.id;
    db.query(querySize).then(res => {
        bot.sendMessage(chatId, util.format(dbSizeText, res.rows[0]));
    })
});

bot.onText(/^([a-zA-Z0-9_а-яА-Я]+) ([a-zA-Z0-9_а-яА-Я,. ]+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const vars = [match[1].replaceAll('_', ' '), match[2], msg.chat.username]

    db.query(queryInsert, vars).then(res => {
        bot.sendMessage(chatId, util.format(dbSizeText, res.rows[0]['id']));
    }).catch(e => console.error(e.stack));
});

bot.on('new_chat_members', (msg) => {
    bot.sendMessage(msg.chat.id, welcomeText);
})

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, welcomeText);
})