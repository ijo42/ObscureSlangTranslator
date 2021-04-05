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
                [
                    {
                        text: 'Yes!',
                        callback_data: 'Y',
                        callback: () =>
                            prisma.telemetry.update({
                                where: e,
                                data: {
                                    is_useful: true
                                }
                            }).then(() => bot.sendMessage(originalMsg.chat.id, "Thanks!"))
                    },
                    {
                        text: 'No',
                        callback_data: 'N',
                        callback: () => prisma.telemetry.update({
                            where: e,
                            data: {
                                is_useful: false,
                                origin_message: originalMsg.text
                            }
                        }).then(() => bot.sendMessage(originalMsg.chat.id, "Thanks!"))
                    }
                ]
            ],
            restrictedTo: originalMsg.from.id
        }

        bot.sendMessage(originalMsg.chat.id, "Was this helpful?",
            {
                reply_markup: markup
            }).then(r => registerCallback(r, markup));
    });
}

export function requestIDKFeedback(originalMsg: Message) {
    if (!originalMsg.from)
        return;

    const markup: Keyboard = {
        inline_keyboard: [
            [
                {
                    text: 'Yes',
                    callback_data: 'Y',
                    callback: () => {
                        if (originalMsg.from)
                            return prisma.telemetry.create({
                                data: {
                                    is_useful: false,
                                    author: formatUsername(originalMsg.from),
                                    origin_message: originalMsg.text
                                }
                            }).then(() => bot.sendMessage(originalMsg.chat.id, "Thanks!"));
                        return Promise.resolve();
                    }
                },
                {
                    text: 'No',
                    callback_data: 'N',
                    callback: () => Promise.resolve()
                }
            ]
        ],
        restrictedTo: originalMsg.from.id
    }

    bot.sendMessage(originalMsg.chat.id, "Should I report this?",
        {
            reply_markup: markup
        }).then(r => registerCallback(r, markup));
}