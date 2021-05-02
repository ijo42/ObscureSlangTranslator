import {
    collectTelemetry,
} from "./templates";
import { texts } from "./texts";
import { bot } from "./app";
import {
    BaseFormatting, TelegramFormatting,
} from "./utils/formatting";
import { eraseTerm, fuzzySearch } from "./utils/fuzzySearch";
import { hasRights, promoteUser } from "./utils/moderate";
import prisma from "./db";
import regexpBuild, { baseRegexp, compiledRegexp } from "./utils/regexpBuilder";
import TelegramBot from "node-telegram-bot-api";
import { requestIDKFeedback, requestTermFeedback } from "./utils/telemetry";
import {
    categorizeMarkup,
    Command,
    keyboardWithConfirmation, moderateMarkup,
    processReplenishment, telemetryMarkup,
} from "./telegram/templates";
import { registerCallback } from "./telegram/inLineHandler";
import { genPic } from "./utils/drawing";

export const commands: Command[] = [
    {
        command: "/size",
        regexp: regexpBuild("size"),
        description: texts.commandsAround.size.desk,
        callback(msg: TelegramBot.Message): void {
            prisma.obscure.count()
                .then(num => bot.sendMessage(msg.chat.id, BaseFormatting.formatDBSize(num)));
        },
    },

    {
        command: "/add",
        regexp: regexpBuild("add", baseRegexp.lazyMatch),
        description: texts.commandsAround.add.desk,
        callback(msg: TelegramBot.Message, match: RegExpExecArray | null): void {

            if (!match || !msg.from || !match[1] || !match[2]) {
                return;
            }

            function upload() {
                processReplenishment(entry, <TelegramBot.User>msg.from)
                    .then(() => bot.sendMessage(msg.chat.id, `${texts.thx} ${texts.reviewPromise}`))
                    .catch(e => bot.sendMessage(msg.chat.id, e));
            }
            const chatId = msg.chat.id;
            const vars: string[] = BaseFormatting.reformat(
                BaseFormatting.capitalize([match[1], match[2]]),
            );
            const fuzzy = fuzzySearch(vars);
            if (!(vars[0] && vars[1])) {
                throw new Error("Empty term array");
            }

            const entry = {
                id: -1, synonyms: [],
                term: vars[0],
                value: vars[1],
            };

            if (fuzzy) {
                const keyboard = keyboardWithConfirmation(upload, "Force", msg.from.id);
                bot.sendMessage(chatId, BaseFormatting.formatDuplicationCheck(fuzzy), {
                    reply_markup: keyboard,
                    parse_mode: "MarkdownV2",
                })
                    .then(answer => registerCallback(answer, keyboard));
            } else {
                upload();
            }
        },
    },

    {
        command: "/start",
        regexp: regexpBuild("start"),
        description: "Welcome-Command",
        callback: msg => bot.sendMessage(msg.chat.id, texts.welcome),
    },
    {
        command: "/get",
        regexp: regexpBuild("get", baseRegexp.searchableExp),
        description: texts.commandsAround.get.desk,
        callback: (msg, match) => bot.sendMessage(msg.chat.id, TelegramFormatting.fuzzyFormat(match), {
            parse_mode: "MarkdownV2",
        }),
    },
    {
        command: "/promote",
        regexp: regexpBuild("promote"),
        description: texts.commandsAround.promote.desk,
        callback(msg: TelegramBot.Message): void {
            const promoterId = msg.from?.id;
            if (promoterId && hasRights(promoterId)) {
                if (msg.reply_to_message?.from && !msg.reply_to_message.from.is_bot) {
                    const promotable = msg.reply_to_message.from;
                    const keyboard = keyboardWithConfirmation(() => promoteUser(promotable, promoterId)
                        .then(() => {
                            if (hasRights(promotable.id)) {
                                bot.sendMessage(msg.chat.id, "Already has rights");
                                return;
                            }
                            bot.sendMessage(msg.chat.id, texts.successfulPromoting);
                            bot.sendMessage(promotable.id, texts.promoteAnnounce)
                                .catch(() => bot.sendMessage(msg.chat.id,
                                    `${TelegramFormatting.formatMention(promotable)}, ${
                                        texts.promoteAnnounce}`));

                        })
                        .catch(e => bot.sendMessage(promoterId, e.stack)), "Promote", promoterId);

                    bot.sendMessage(msg.chat.id, TelegramFormatting.formatUserPromotion(texts.confirmPromotion, promotable), {
                        reply_markup: keyboard,
                    })
                        .then(value => registerCallback(value, keyboard));
                } else {
                    bot.sendMessage(msg.chat.id, texts.provideAUser, {
                        parse_mode: "MarkdownV2",
                    });
                }
            } else {
                bot.sendMessage(msg.chat.id, texts.hasNoRights);
            }
        },
    },
    {
        command: "/moderate",
        regexp: regexpBuild("moderate"),
        description: texts.commandsAround.moderate.desk,
        callback(msg: TelegramBot.Message): void {
            if (!msg.from || !hasRights(msg.from?.id)) {
                bot.sendMessage(msg.chat.id, texts.hasNoRights);
            } else {
                prisma.staging.findFirst({
                    take: 1,
                    where: {
                        status: "waiting",
                    },
                    select: {
                        id: true,
                        value: true,
                        term: true,
                        users: true,
                    },
                })
                    .then(res => {
                        if (!res) {
                            bot.sendMessage(msg.chat.id, texts.noStaging);
                            return;
                        }
                        if (!msg.from) {
                            throw new Error("msg.from is undefined");
                        }
                        const match = {
                            id: -1, synonyms: [],
                            stagingId: res.id,
                            value: res.value,
                            term: res.term,
                            author: {
                                id: <number>res.users.telegram_id,
                                first_name: <string>res.users.telegram_username,
                            },
                            reviewer: msg.from.id,
                            reviewingChat: msg.chat.id,
                            msgId: msg.message_id,
                        };
                        const keyboard = moderateMarkup(match, msg.from.id);

                        bot.sendMessage(msg.chat.id, `Accept: ${TelegramFormatting.formatAnswer(match)}`, {
                            parse_mode: "MarkdownV2",
                            reply_markup: keyboard,
                        })
                            .then(r => registerCallback(r, keyboard));
                    })
                    .catch(e => console.error(e.stack));
            }
        },
    },
    {
        regexp: regexpBuild("picture", baseRegexp.searchableExp),
        command: "/picture",
        description: texts.commandsAround.picture.desk,
        callback(msg: TelegramBot.Message, match: RegExpExecArray | null): void {
            const entry = fuzzySearch(match);
            if (entry) {
                genPic(entry).then(buff => bot.sendPhoto(msg.chat.id, buff, {
                    caption: BaseFormatting.formatAnswerUnpreceded(entry),
                }));
                requestTermFeedback(entry, msg);
            } else {
                bot.sendMessage(msg.chat.id, "IDK");
                requestIDKFeedback(msg);
            }
        },
    },
    {
        regexp: regexpBuild("category"), command: "/category",
        description: texts.commandsAround.category.desk,
        callback(msg: TelegramBot.Message): void {
            if (msg.from && hasRights(msg.from.id)) {
                const keyboard = categorizeMarkup(msg.chat.id, msg.from?.id);
                bot.sendMessage(msg.chat.id, "Choose an action", {
                    reply_markup: keyboard,
                })
                    .then(r => registerCallback(r, keyboard));
            }
        },
    },
    {
        regexp: regexpBuild("delete", baseRegexp.fullMatch), command: "/delete",
        description: texts.commandsAround.delete.desk,
        callback(msg: TelegramBot.Message, match: RegExpExecArray | null): void {
            if (msg.from && hasRights(msg.from.id)) {
                const obscureTerm = fuzzySearch(match);
                if (!obscureTerm) {
                    bot.sendMessage(msg.chat.id, "Not found");
                    return;
                }
                const confirm = keyboardWithConfirmation(() => {
                    console.log(`Deleted term ${JSON.stringify(obscureTerm)}`);
                    prisma.obscure.delete({
                        where: {
                            id: obscureTerm.id,
                        },
                        select: {},
                    })
                        .then(() => eraseTerm(obscureTerm))
                        .then(() => bot.sendMessage(msg.chat.id, "Successful"));
                }, "Force", msg.from.id);
                bot.sendMessage(msg.chat.id, BaseFormatting.concreteTerm(obscureTerm), {
                    reply_markup: confirm,
                })
                    .then(r => registerCallback(r, confirm));
            } else {
                bot.sendMessage(msg.chat.id, texts.hasNoRights);
            }
        },
    },
    {
        regexp: regexpBuild("telemetry"),
        command: "/telemetry",
        description: texts.commandsAround.telemetry.desk,
        callback(msg: TelegramBot.Message): void {
            if (msg.from && hasRights(msg.from.id)) {
                collectTelemetry()
                    .then(entry => {
                        if (msg.from && entry) {
                            const replyMarkup = telemetryMarkup(msg, msg.from.id);
                            bot.sendMessage(msg.chat.id, BaseFormatting.formatTelemetry(entry), {
                                reply_markup: replyMarkup,
                            })
                                .then(e => {
                                    registerCallback(e, replyMarkup);
                                });
                        } else {
                            bot.sendMessage(msg.chat.id, texts.telemetryModerate.noWaiting);
                        }
                    });
            } else {
                bot.sendMessage(msg.chat.id, texts.hasNoRights);
            }
        },
    },
    {
        regexp: regexpBuild("status"),
        command: "/status",
        description: texts.commandsAround.status.desk,
        callback(msg: TelegramBot.Message): void {
            if (msg.from && hasRights(msg.from.id)) {
                Promise.all([prisma.telemetry.count({
                    where: {
                        moderated_by: null,
                        is_useful: false,
                    },
                }), prisma.staging.count({
                    where: {
                        status: "waiting",
                    },
                })]).then(([telemetry, staging]) => bot.sendMessage(msg.chat.id, BaseFormatting.formatStatus(telemetry, staging)));
            } else {
                bot.sendMessage(msg.chat.id, texts.hasNoRights);
            }
        },
    },
];

export const defaultCommand = {
    regexp: compiledRegexp.searchableExp,
    callback(msg: TelegramBot.Message, match: RegExpExecArray | null): void {
        if (msg.from && msg.chat.type === "private" && msg.text && !msg.text.startsWith("/") && !msg.reply_to_message) {
            const entry = fuzzySearch(match);
            if (entry) {
                genPic(entry).then(buff => bot.sendPhoto(msg.chat.id, buff, {
                    caption: BaseFormatting.formatAnswerUnpreceded(entry),
                }));
                requestTermFeedback(entry, msg, true);
            } else {
                bot.sendMessage(msg.chat.id, "IDK");
                requestIDKFeedback(msg);
            }
        }
    },
};
