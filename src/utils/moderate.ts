import { randomString } from "./formatting";
import { bot } from "../app";
import { texts } from "../texts";
import { format } from "util";
import prisma from "../db";

const moderators = new Map<number, number>();
// TELEGRAM USER ID, MODERATOR ID

function firstStart() {
    if (moderators.size === 0) {
        let setupUUID = randomString();
        bot.onText(/\/setup (\w{8})/, ((msg, match) => {
            const promotable = msg.from;
            if (promotable && match && match[1] === setupUUID) {
                promoteUser(promotable.id, -1).then(() => setupUUID = "").then(() =>
                    bot.sendMessage(promotable.id, texts.promoteAnnounce))
                    .catch(e => bot.sendMessage(promotable.id, e.stack));
            }
        }));
        console.info(format(texts.firstStart, `/setup ${setupUUID}`));
    }
}

export default async function setup() {
    await prisma.moderators.findMany({
        select: {
            "id": true,
            "user_id": true
        }
    }).then(val => val.forEach(usr => moderators.set(usr.user_id, usr.id)))
        .then(() => firstStart());
}

export function hasRights(userId: number | undefined): number | undefined {
    return !userId ? undefined : moderators.get(userId);
}

export function promoteUser(promotable: number, promoter: number) {
    return prisma.moderators.create({
        data: {
            promoted_by: promoter,
            user_id: promotable
        },
        select: {
            "id": true,
            "user_id": true
        }
    }).then(usr => moderators.set(usr.user_id, usr.id));
}