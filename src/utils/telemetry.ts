import { Keyboard, ObscureEntry } from "../templates";
import { Message } from "node-telegram-bot-api";
import { bot } from "../app";
import { registerCallback } from "../inLineHandler";
import prisma from "../db";
import { formatUsername } from "./formatting";


export function requestTermFeedback(term: ObscureEntry, originalMsg: Message, feedbackRequested: boolean = false) {
    if (!originalMsg.from)
        return;

    prisma.telemetry.create({
        data: {
            requested_term_id: term.id,
            author: formatUsername(originalMsg.from)
        },
        select: {
            id: true
        }
    }).then(e => {
        if (!(originalMsg.from && feedbackRequested))
            return;

        const markup: Keyboard = {
            inline_keyboard: [
                [{
                    text: 'Yes!',
                    callback_data: 'Y',
                    callback: _query =>
                        prisma.telemetry.update({
                            where: e,
                            data: {
                                is_useful: true
                            }
                        }).then(() => bot.sendMessage(originalMsg.chat.id, "Thanks!"))
                }],
                [{
                    text: 'No',
                    callback_data: 'N',
                    callback: _query => prisma.telemetry.update({
                        where: e,
                        data: {
                            is_useful: false
                        }
                    }).then(() => bot.sendMessage(originalMsg.chat.id, "Thanks!"))
                }]
            ],
            restrictedTo: originalMsg.from.id
        }

        bot.sendMessage(originalMsg.chat.id, "Did it's helpful?",
            {
                reply_markup: markup
            }).then(r => registerCallback(r, markup));
    });
}