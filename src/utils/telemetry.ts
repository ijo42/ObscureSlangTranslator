import { Keyboard, ObscureEntry } from "../templates";
import { Message } from "node-telegram-bot-api";
import { bot } from "../app";
import { registerCallback } from "../inLineHandler";
import prisma from "../db";
import { formatUsername } from "./formatting";
import { texts } from "../texts";


export function requestTermFeedback(term: ObscureEntry, originalMsg: Message, feedbackRequested = false): void {
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
                        text: `${texts.binary.yes}!`,
                        callback_data: "Y",
                        callback: () =>
                            prisma.telemetry.update({
                                where: e,
                                data: {
                                    is_useful: true
                                }
                            }).then(() => bot.sendMessage(originalMsg.chat.id, texts.thx))
                    },
                    {
                        text: texts.binary.no,
                        callback_data: "N",
                        callback: () => prisma.telemetry.update({
                            where: e,
                            data: {
                                is_useful: false,
                                origin_message: originalMsg.text
                            }
                        }).then(() => bot.sendMessage(originalMsg.chat.id, texts.changePromise))
                    }
                ]
            ],
            restrictedTo: originalMsg.from.id
        };

        bot.sendMessage(originalMsg.chat.id, texts.requestFeedback,
            {
                reply_markup: markup
            }).then(r => registerCallback(r, markup));
    });
}

export function requestIDKFeedback(originalMsg: Message): void {
    if (!originalMsg.from)
        return;

    const markup: Keyboard = {
        inline_keyboard: [
            [
                {
                    text: texts.binary.yes,
                    callback_data: "Y",
                    callback: () => {
                        if (originalMsg.from)
                            prisma.telemetry.create({
                                data: {
                                    is_useful: false,
                                    author: formatUsername(originalMsg.from),
                                    origin_message: originalMsg.text
                                }
                            }).then(() => bot.sendMessage(originalMsg.chat.id, texts.changePromise));
                    }
                },
                {
                    text: texts.binary.no,
                    callback_data: "N",
                    callback: () => bot.sendMessage(originalMsg.chat.id, texts.thx)
                }
            ]
        ],
        restrictedTo: originalMsg.from.id
    };

    bot.sendMessage(originalMsg.chat.id, texts.requestIDKFeedback,
        {
            reply_markup: markup
        }).then(r => registerCallback(r, markup));
}