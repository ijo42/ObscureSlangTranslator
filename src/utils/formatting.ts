import TelegramBot from "node-telegram-bot-api";
import * as util from "util";
import { ObscureEntry } from "../templates";

export const formatUsername = (user: TelegramBot.User) => {
    return util.format(`%s <${user.id}>`, user.username ||
        `${user.first_name} ${user.last_name || '-'}`);
};

export const formatAnswer = (entry: ObscureEntry) =>
    precedeChar(`${entry.term} - ${entry.value}`);

export const capitalizeFirstLetter = ([...rest]) =>
    rest.shift().toLocaleUpperCase() + rest.join('');

export const capitalize: ([...st]: readonly any[]) => any = ([...st]) =>
    st.map(str => capitalizeFirstLetter(str));

export const precedeChar: (s: string) => string = (s: string) =>
    s.replace(/([_\]\[)(~>#+\-=|}{.!])/gm, `\\$1`);
