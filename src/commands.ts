import {Command, ObscureEntry} from "./templates";
import {queries} from "./db/patterns";
import {QueryResult} from "pg";
import {texts} from "./texts";
import * as util from "util";
import {bot} from "./app";
import {capitalize, formatAnswer, formatUsername} from "./utils/formatting";
import {fuse, fuzzyFormat, fuzzySearch} from "./utils/fuzzySearch";

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
            const vars: string[] = capitalize([match[2], match[3]]);
            const fuzzy = fuzzySearch(vars);
            vars.push(formatUsername(msg.from));
            if (fuzzy)
                bot.sendMessage(chatId, util.format('Are you sure that this is not a duplicate for \n%s\nIf mistake, reply \`FORCE\`', formatAnswer(fuzzy)), {
                    reply_markup: {
                        force_reply: true,
                    }
                }).then(answer => {
                    bot.onReplyToMessage(answer.chat.id, answer.message_id, msg => {
                        if (msg.text === "FORCE") {
                            processReplenishment(vars, msg.chat.id);
                            bot.deleteMessage(answer.chat.id, String(answer.message_id)) // ONLY 48 HOURS
                        }
                    });
                });
            else
                processReplenishment(vars, chatId);
        })],

    ["start", new Command(/\/start/, 'Welcome-Command',
        (msg) => {
            bot.sendMessage(msg.chat.id, texts.welcome);
        })],
    ["get", new Command(/\/get ([a-zA-Z0-9_а-яА-Я ]+)/, 'Get Fuzzy Terms',
        (msg, match) => {
            bot.sendMessage(msg.chat.id, fuzzyFormat(match));
        })]
]);

function processReplenishment(vars: any, chatId: number) {
    db.query(queries.insertTerm, vars).then((res: QueryResult) => {
        fuse.add(new ObscureEntry(
            vars[0], vars[1]
        ));
        const row = res.rows[0];
        if (row)
            bot.sendMessage(chatId, util.format(texts.dbSize, row['id']));
        else
            console.error("res.rows[0] is null: ", JSON.stringify(res));
    }).catch((e: any) => console.error(e.stack));
}
