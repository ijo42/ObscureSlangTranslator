import { ObscureEntry } from "../templates";
import { Message } from "node-telegram-bot-api";
import { texts } from "../texts";
import { TelegramInteraction, TelemetryInteraction } from "../db/interaction";
import { Keyboard } from "./templates";
import { bot, registerCallback } from "./bot";

export function requestTermFeedback(term: ObscureEntry, originalMsg: Message, feedbackRequested = false): void {
    if (!originalMsg.from) {
        return;
    }

    TelegramInteraction.termFeedback(term, originalMsg.from).then(e => {
        if (!(originalMsg.from && feedbackRequested)) {
            return;
        }

        const markup: Keyboard = {
            inline_keyboard: [
                [
                    {
                        text: `${texts.binary.yes}!`,
                        callback_data: "Y",
                        callback: () => TelemetryInteraction.markUseful(e)
                            .then(() => bot.sendMessage(originalMsg.chat.id, texts.thx)),
                    },
                    {
                        text: texts.binary.no,
                        callback_data: "N",
                        callback: () => TelegramInteraction.markUseless(e, originalMsg)
                            .then(() => bot.sendMessage(originalMsg.chat.id, texts.changePromise)),
                    },
                ],
            ],
            restrictedTo: originalMsg.from.id,
        };

        bot.sendMessage(originalMsg.chat.id, texts.requestFeedback, {
            reply_markup: markup,
        }).then(r => registerCallback(r, markup));
    });
}

export function requestIDKFeedback(originalMsg: Message): void {
    if (!originalMsg.from) {
        return;
    }

    const markup: Keyboard = {
        inline_keyboard: [
            [
                {
                    text: texts.binary.yes,
                    callback_data: "Y",
                    callback: () => {
                        if (originalMsg.from) {
                            TelegramInteraction.requestTerm(originalMsg.from, originalMsg)
                                .then(() => bot.sendMessage(originalMsg.chat.id, texts.changePromise));
                        }
                    },
                },
                {
                    text: texts.binary.no,
                    callback_data: "N",
                    callback: () => bot.sendMessage(originalMsg.chat.id, texts.thx),
                },
            ],
        ],
        restrictedTo: originalMsg.from.id,
    };

    bot.sendMessage(originalMsg.chat.id, texts.requestIDKFeedback, {
        reply_markup: markup,
    }).then(r => registerCallback(r, markup));
}
