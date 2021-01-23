const TelegramBot = require('node-telegram-bot-api');
const db = require("./db");
const util = require("util");
const patterns = require("dbPatterns");

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
global.debug = process.env.debug || false;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

bot.onText(patterns.commands.size.regexp, (msg) => {
    const chatId = msg.chat.id;
    db.query(patterns.queries.lastIndex).then(res => {
        bot.sendMessage(chatId, util.format(patterns.texts.dbSize, res.rows[0]['max']));
    })
});

bot.onText(patterns.commands.add.regexp, (msg, [, command, term, value]) => {
    if (msg.chat.type === 'private' || command)
        return;
    const chatId = msg.chat.id;
    const user = msg.from;
    const username = (user.username || util.format('%s %s', user.first_name, user.last_name || '-')) +
        util.format(' <%i>', user.id);
    const vars = [term, value, username];

    db.query(patterns.queries.insertTerm, vars).then(res => {
        bot.sendMessage(chatId, util.format(patterns.texts.dbSize, res.rows[0]['id']));
    }).catch(e => console.error(e.stack));
});

bot.on('new_chat_members', (msg) => {
    bot.sendMessage(msg.chat.id, patterns.texts.welcome);
})

bot.onText(patterns.commands.start.regexp, (msg) => {
    bot.sendMessage(msg.chat.id, patterns.texts.welcome);
})

bot.on('polling_error', (error) => {
    console.log(error.code);  // => 'EFATAL'
});