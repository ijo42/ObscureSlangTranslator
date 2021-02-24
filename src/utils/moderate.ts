import { randomString } from "./formatting";
import { bot } from "../app";
import { texts } from "../texts";
import { format } from "util";
import prisma from "../db";

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
    await prisma.moderators.findMany({
        select: {
            "user_id": true
        }
    }).then(val => moderators.push(...val.map(u => u.user_id)))
        .then(() => firstStart())
        .catch((e: any) => console.error(e.stack));
}

export function hasRights(userId: number): boolean {
    return moderators.includes(userId);
}

export function promoteUser(promotable: number, promoter: number): Promise<number> {
    return prisma.moderators.create({
        data: {
            promoted_by: promoter,
            user_id: promotable
        },
        select: {
            "user_id": true
        }
    }).then(() => moderators.push(promotable));
}