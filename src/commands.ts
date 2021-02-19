import { Command, ObscureEntry, processReplenishment } from "./templates";
import { queries } from "./db/patterns";
import { QueryResult } from "pg";
import { texts } from "./texts";
import { bot } from "./app";
import { capitalize, formatAnswer, formatDBSize, formatUsername } from "./utils/formatting";
import { fuzzyFormat, fuzzySearch } from "./utils/fuzzySearch";
import { registerCallback } from "./inLineHandler";

const db = require("./db");
const markup = require("./templates");

export let commands = new Map<string, Command>([
    ["size", {
        regexp: /\/size/,
        desk: 'Get last DB index',
        callback: (msg => {
            const chatId = msg.chat.id;
            db.query(queries.lastIndex).then((res: QueryResult) => {
                const reElement = res.rows[0];
                if (reElement)
                    bot.sendMessage(chatId, formatDBSize(reElement['max']));
                else
                    console.error("res.rows[0] is null: ", JSON.stringify(res));
            })
        })
    }
    ],

    ["add", {
        regexp: /^(\/add )?([a-zA-Z0-9_а-яА-Я]{2,})(?:(?:\s?-\s?)|\s+)([a-zA-Z0-9_а-яА-Я,.\-)( ]{2,})$/,
        desk: 'Main upload command',
        callback: (msg, match) => {
            if (!match || !msg.from || (msg.chat.type !== 'private' && !match[1]))
                return;
            const chatId = msg.chat.id;
            const vars: string[] = capitalize([match[2], match[3]]);
            const fuzzy = fuzzySearch(vars);
            const entry: ObscureEntry = {
                id: -1, synonyms: [],
                term: <string>vars[0],
                value: <string>vars[1]
            };
            const upload = () => {
                processReplenishment(entry, msg.from ? formatUsername(msg.from) : '').then(value =>
                    bot.sendMessage(msg.chat.id, formatDBSize(value.rows[0].id)));
            }

            if (fuzzy) {
                const keyboard = markup.forceUpload(upload);
                bot.sendMessage(chatId, `Are you sure that this is not a duplicate for
*${formatAnswer(fuzzy)}*
If mistake, click \`Force\``, {
                    reply_markup: keyboard,
                    parse_mode: "MarkdownV2"
                }).then(answer => registerCallback(answer, keyboard));
            } else
                upload();
        }
    }
    ],

    ["start", {
        regexp: /\/start/,
        desk: 'Welcome-Command',
        callback: (msg) => {
            bot.sendMessage(msg.chat.id, texts.welcome);
        }
    }],
    ["get", {
        regexp: /\/get ([a-zA-Z0-9_а-яА-Я ]+)/, desk: 'Get Fuzzy Terms',
        callback: (msg, match) => {
            bot.sendMessage(msg.chat.id, fuzzyFormat(match), {
                parse_mode: "MarkdownV2"
            });
        }
    }]
]);