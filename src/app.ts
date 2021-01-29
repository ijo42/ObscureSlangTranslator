import TelegramBot from "node-telegram-bot-api";
import {QueryResult} from "pg";

const db = require("./db");
const util = require("util");

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
// @ts-ignore
global.debug = process.env.debug || false;
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

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
    db.query(queries.lastIndex).then((res: QueryResult) => {
        const reElement = res.rows[0];
        if (reElement)
            bot.sendMessage(chatId, util.format(texts.dbSize, reElement['max']));
        else
            console.error("res.rows[0] is null: ", JSON.stringify(res));
    })
});

bot.onText(commands.add.regexp, (msg, match) => {
    if (!match || !msg.from || (msg.chat.type !== 'private' && match[1] === undefined))
        return;
    const chatId = msg.chat.id;
    const vars = capitalize([match[2], match[3], formatUsername(msg.from)]);

    db.query(queries.insertTerm, vars).then((res: QueryResult) => {
        const row = res.rows[0];
        if (row)
            bot.sendMessage(chatId, util.format(texts.dbSize, row['id']));
        else
            console.error("res.rows[0] is null: ", JSON.stringify(res));
    }).catch((e: any) => console.error(e.stack));
});

bot.on('new_chat_members', (msg) => {
    bot.sendMessage(msg.chat.id, texts.welcome);
})

bot.onText(commands.start.regexp, (msg) => {
    bot.sendMessage(msg.chat.id, texts.welcome);
})

bot.on('polling_error', (error) => {
    console.log(JSON.stringify(error));  // => 'EFATAL'
});

function formatUsername(user: TelegramBot.User) {
    return util.format('%s <%i>', (user.username ||
        util.format('%s %s', user.first_name, user.last_name || '-')), user.id);
}

function capitalizeFirstLetter([...rest]) {
    return rest.shift().toLocaleUpperCase() + rest.join('')
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