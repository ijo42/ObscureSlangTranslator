import { queries } from "../db/patterns";
import { QueryResult } from "pg";
import { randomString } from "./formatting";
import { bot } from "../app";
import { texts } from "../texts";
import { format } from "util";

const db = require("../db");
const moderators: number[] = [];

function firstStart() {
    if (moderators.length === 0) {
        let setupUUID = randomString();
        console.info(format(texts.firstStart, `/setup ${setupUUID}`));
        bot.onText(/\/setup (\w{8})/, ((msg, match) => {
            const promotable = msg.from;
            if (promotable && match && match[1] === setupUUID) {
                promoteUser(promotable.id, -1).then(() => setupUUID = '').then(() => {
                    bot.sendMessage(promotable.id, texts.promoteAnnounce);
                }).catch(e => bot.sendMessage(promotable.id, e.stack));
            }
        }));
    }
}

export default async function setup() {
    await db.query(queries.moderatorCache).then((res: QueryResult) =>
        res.rows.forEach(value => moderators.push(value.user_id)))
        .then(() => firstStart()).catch((e: any) => console.error(e.stack));
}

export function hasRights(userId: number): boolean {
    return moderators.includes(userId);
}

export function promoteUser(promotable: number, promoter: number): Promise<number> {
    return db.query(queries.insertModerator, [promotable, promoter]).then(() => moderators.push(promotable));
}