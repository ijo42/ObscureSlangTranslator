import { randomString } from "./formatting";
import { bot } from "../app";
import { texts } from "../texts";
import { format } from "util";
import prisma from "../db";
import { User, userValidate } from "../db/interaction";

const moderators = new Map<number, number>();
// TELEGRAM USER ID, MODERATOR ID

function firstStart() {
    if (moderators.size === 0) {
        let setupUUID = randomString();
        bot.onText(/\/setup (\w{8})/, (msg, match) => {
            const promotable = msg.from;
            if (promotable && match && match[1] === setupUUID) {
                promoteUser(promotable, -1).then(() => setupUUID = "")
                    .then(() => bot.sendMessage(promotable.id, texts.promoteAnnounce))
                    .catch(e => bot.sendMessage(promotable.id, e.stack));
            }
        });
        console.info(format(texts.firstStart, `/setup ${setupUUID}`));
    }
}

export default async function setup(): Promise<void> {
    await prisma.moderators.findMany({
        select: {
            id: true,
            users: true,
        },
    }).then(val => val.forEach(usr => {
        if(usr.users.telegram_id !== null) {
            moderators.set(usr.users.telegram_id, usr.id);
        }
    }))
        .then(() => firstStart());
}

export function hasRights(userId: number | undefined): number | undefined {
    return !userId ? undefined : moderators.get(userId);
}

export const promoteUser: (promotable: User, promoterId: number) => Promise<unknown> = (promotable: User, promoter: number) => prisma.moderators.create({
    data: {
        promoted_by: promoter,
        users: userValidate(promotable),
    },
    select: {
        id: true,
        users: true,
    },
}).then(usr => moderators.set(<number>usr.users.telegram_id, usr.id));