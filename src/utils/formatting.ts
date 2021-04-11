import * as util from "util";
import { ObscureEntry } from "../templates";
import { texts } from "../texts";
import { randomBytes } from "crypto";

export const formatUsername = (user: { id: number, username?: string, first_name?: string, last_name?: string }) => {
    return util.format(`%s <${user.id}>`, user.username ||
        `${user.first_name} ${user.last_name || '-'}`);
};

export const formatAnswerUnpreceded = (entry: ObscureEntry) =>
    `${entry.term} - ${entry.value}`;

export const formatAnswer = (entry: ObscureEntry) =>
    precedeChar(formatAnswerUnpreceded(entry));

export const capitalizeFirstLetter = ([...rest]) =>
    rest.shift().toLocaleUpperCase() + rest.join('');

export const capitalize: ([...st]: readonly any[]) => any = ([...st]) =>
    st.map(str => capitalizeFirstLetter(str));

export const precedeChar: (s: string) => string = (s: string) =>
    s.replace(/([_\]\[)(~>#+\-=|}{.!])/gm, `\\$1`);

export const grabUsrID: (s: string) => string = (s: string) =>
    s.slice(s.lastIndexOf('<') + 1, s.lastIndexOf('>'));

export const formatDBSize = (s: string | number) =>
    util.format(texts.dbSize, s.toString());

export const formatDuplicationCheck = (entry: ObscureEntry) =>
    util.format(texts.duplicationCheck, formatAnswer(entry))

export const formatMention = (promotable: { id: number; username?: string; first_name?: string; last_name?: string }) =>
    promotable.username ? "@" : "" + formatUsername(promotable);

export const formatUserPromotion = (text: string, promotable: { id: number, username?: string, first_name?: string, last_name?: string }) =>
    util.format(text, formatMention(promotable))

export const formatStatus = (telemetryEntry: number, staging: number) => {
    return `${texts.commandsAround.status.desk}:
${texts.awaitedModerating}: ${staging} ${texts.terms}
${texts.awaitedModerating}: ${telemetryEntry} ${texts.telemetry}`;
}

export const formatTelemetry = (entry: { obscure: ObscureEntry | null; id: number; is_useful: boolean | null; origin_message: string | null; }) => {
    return `ID: <${entry.id}>
${texts.telemetryModerate.helpful}: ${entry.is_useful}
${texts.telemetryModerate.originMsg}: ${entry.origin_message}
${texts.telemetryModerate.botAnswer}: ${entry.obscure?.term}`;
}

export const reformatStr = (s: string) =>
    s.replace("_", " ")
        .replace(/ {2,}/g, ` `)
        .replace(/([.,!?] )(a-zA-Zа-яА-Я])/g, `$1 $2`);

export const reformat: ([...st]: readonly any[]) => any = ([...st]) =>
    st.map(str => reformatStr(str));

export function randomString(size = 8) {
    return randomBytes(size)
        .toString('base64')
        .slice(0, size)
}