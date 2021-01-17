const TelegramBot = require('node-telegram-bot-api');
const db = require("./db");
const util = require("util");

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
global.debug = false;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

const queryInsert = 'INSERT INTO obscure(term, value, author) VALUES($1, $2, $3) RETURNING *';
const echoText = 'Currently, DB contains %s terms';

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
    // 'msg' is the received Message from Telegram
    // 'match' is the result of executing the regexp above on the text content
    // of the message

    const chatId = msg.chat.id;
    const resp = match[1]; // the captured "whatever"

    // send back the matched "whatever" to the chat
    bot.sendMessage(chatId, resp);
});


bot.onText(/^\/save (\w+) ([\w\s.]+)$/, (msg, match) => {
    // 'msg' is the received Message from Telegram
    // 'match' is the result of executing the regexp above on the text content
    // of the message

    const chatId = msg.chat.id;
    const vars = [match[1], match[2], msg.chat.username]

    db.query(queryInsert, vars).then(res => {
        bot.sendMessage(chatId, util.format(echoText, res.rows[0]['id']));
    }).catch(e => console.error(e.stack));
});

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // send a message to the chat acknowledging receipt of their message
    bot.sendMessage(chatId, 'Received your message');
});