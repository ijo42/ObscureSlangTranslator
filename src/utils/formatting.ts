import * as util from "util";
import { texts } from "../texts";
import { randomBytes } from "crypto";
import { TelegramInteraction } from "../db/interaction";
import { fuzzySearch } from "./fuzzySearch";
import { obscure } from "@prisma/client";

export namespace TelegramFormatting {

    export const formatUsername: (user: TelegramInteraction.User) => string =
        (user: TelegramInteraction.User) => user.username ||
            `${user.first_name} ${user.last_name || "-"}`;

    export const formatMention: (promotable: TelegramInteraction.User) => string =
        (promotable: TelegramInteraction.User) => promotable.username ? "@" : `${formatUsername(promotable)}`;

    export const formatUserPromotion: (text: string, promotable: TelegramInteraction.User) => string =
        (text: string, promotable: TelegramInteraction.User) => util.format(text, formatMention(promotable));

    export const precedeChar: (s: string) => string =
        (s: string) => s.replace(/([_\][)(~>#+\-=|}{.!])/gm, "\\$1");

    export const formatAnswer: (entry: obscure) => string =
        (entry: obscure) => precedeChar(BaseFormatting.formatAnswerUnpreceded(entry));

    export const fuzzyFormat: (query: (string[] | null)) => string = (query: string[] | null) => {
        const entry = fuzzySearch(query);
        return entry ? TelegramFormatting.formatAnswer(entry) : "*IDK*";
    };

}

export namespace BaseFormatting {

    export const formatAnswerUnpreceded: (entry: obscure) => string =
        (entry: obscure) => `${entry.term} - ${entry.value}`;

    export const capitalizeFirstLetter: ([...rest]: string) => string =
        ([...rest]) => rest.shift()
            ?.toLocaleUpperCase() + rest.join("");

    export const capitalize: ([...st]: readonly string[]) => string[] =
        ([...st]) => st.map(str => capitalizeFirstLetter(str));

    export const grabUsrID: (s: string) => number = (s: string) => {
        if (!s.includes("<") || !s.includes(">")) {
            return  -1;
        }
        return Number(s.slice(s.lastIndexOf("<") + 1, s.lastIndexOf(">")));
    };

    export function formatStatus(telemetryEntry: number, staging: number): string {
        return `${texts.commandsAround.status.desk}:
${texts.awaitedModerating}: ${staging} ${texts.terms}
${texts.awaitedModerating}: ${telemetryEntry} ${texts.telemetry}`;
    }

    export function formatTelemetry(entry: {
        obscure: obscure | null;
        id: number;
        is_useful: boolean | null;
        origin_message: string | null
    }): string {
        return `ID: <${entry.id}>
${texts.telemetryModerate.helpful}: ${entry.is_useful}
${texts.telemetryModerate.originMsg}: ${entry.origin_message}
${texts.telemetryModerate.botAnswer}: ${entry.obscure?.term}`;
    }

    export const formatDBSize: (s: (string | number)) => string =
        (s: string | number) => util.format(texts.dbSize, s.toString());

    export const formatDuplicationCheck: (entry: obscure) => string =
        (entry: obscure) => util.format(texts.duplicationCheck, TelegramFormatting.formatAnswer(entry));

    export const reformatStr: (s: string) => string = (s: string) => s.replace("_", " ")
        .replace(/ {2,}/g, " ")
        .replace(/([.,!?])([a-zA-Zа-яА-Я])/g, "$1 $2");

    export const reformat: ([...st]: readonly any[]) => any = ([...st]) => st.map(str => reformatStr(str));

    export function concreteTerm(item: obscure): string {
        return `Term: ${item.term}
Definition: ${item.value}
Id: ${item.id}`;
    }

}

export function randomString(size = 8): string {
    return randomBytes(size)
        .toString("base64")
        .slice(0, size);
}