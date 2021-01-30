import {Command} from "./templates";
import {queries} from "./db/patterns";
import {QueryResult} from "pg";
import {texts} from "./texts";
import * as util from "util";
import {bot} from "./app";
import {capitalize, formatUsername} from "./utils/formatting";
import {obscureCache} from "./cacheManager";

const db = require("./db");

export let commands = new Map<string, Command>([
    ["size", new Command(/\/size/, 'Get last DB index',
        (msg => {
            const chatId = msg.chat.id;
            db.query(queries.lastIndex).then((res: QueryResult) => {
                const reElement = res.rows[0];
                if (reElement)
                    bot.sendMessage(chatId, util.format(texts.dbSize, reElement['max']));
                else
                    console.error("res.rows[0] is null: ", JSON.stringify(res));
            })
        }))],

    ["add", new Command(/^(\/add )?([a-zA-Z0-9_а-яА-Я]+)(?:(?:\s?-\s?)|\s+)([a-zA-Z0-9_а-яА-Я,. -]+)$/,
        'Main upload command',
        (msg, match) => {
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
        })],

    ["start", new Command(/\/start/, 'Welcome-Command',
        (msg) => {
            bot.sendMessage(msg.chat.id, texts.welcome);
        })]
]);