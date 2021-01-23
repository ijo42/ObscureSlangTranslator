const TelegramBot = require('node-telegram-bot-api');
const db = require("./db");
const util = require("util");

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
global.debug = process.env.debug || false;
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

const authorFieldLimit = 32;
const commands = {
    add: {
        regexp: /^(\/add )?([a-zA-Z0-9_а-яА-Я]+)(?:(?:\s?-\s?)|\s+)([a-zA-Z0-9_а-яА-Я,. -]+)$/,
        desk: 'Main upload command'
    },
    size: {
        regexp: /\/size$/,
        desk: 'Get last DB index'
    },
    start: {
        regexp: /\/start/,
        desk: 'Welcome-Command'
    }
}

bot.onText(commands.size.regexp, (msg) => {
    const chatId = msg.chat.id;
    db.query(queries.lastIndex).then(res => {
        bot.sendMessage(chatId, util.format(texts.dbSize, res.rows[0]['max']));
    })
});

bot.onText(commands.add.regexp, (msg, [, command, term, value]) => {
    if (msg.chat.type !== 'private' && command === undefined)
        return;
    const chatId = msg.chat.id;
    const user = msg.from;
    const username = formatUsername(user);
    const vars = capitalize([term, value, username]);

    db.query(queries.insertTerm, vars).then(res => {
        bot.sendMessage(chatId, util.format(texts.dbSize, res.rows[0]['id']));
    }).catch(e => console.error(e.stack));
});

bot.on('new_chat_members', (msg) => {
    bot.sendMessage(msg.chat.id, texts.welcome);
})

bot.onText(commands.start.regexp, (msg) => {
    bot.sendMessage(msg.chat.id, texts.welcome);
})

bot.on('polling_error', (error) => {
    console.log(error.code);  // => 'EFATAL'
});

function formatUsername(user) {
    return util.format('%s <%i>', (user.username ||
        util.format('%s %s', user.first_name, user.last_name || '-'))
            .substring(authorFieldLimit - user.id.length - 3), //DB Limit - two parentheses - space - ID length
        user.id);
}
function capitalizeFirstLetter([first, ...rest]) {
        return first.toLocaleUpperCase() + rest.join('')
}
function capitalize([...st]) {
    return st.map(str => capitalizeFirstLetter(str));
}
const texts = {
    dbSize: 'Currently, DB contains %s terms',
    welcome: 'Welcome, available commands: /size'
}
const queries = {
    insertTerm: 'INSERT INTO obscure(term, value, author) VALUES($1, $2, $3) RETURNING id, term',
    lastIndex: 'SELECT max(id) FROM obscure'
}