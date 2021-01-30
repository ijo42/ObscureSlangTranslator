import TelegramBot from "node-telegram-bot-api";
import * as util from "util";

export const formatUsername = (user: TelegramBot.User) =>
    util.format('%s <%i>', (user.username ||
        util.format('%s %s', user.first_name, user.last_name || '-')), user.id);

export const capitalizeFirstLetter: ([...rest]: readonly any[]) => string = ([...rest]) =>
    rest.shift().toLocaleUpperCase() + rest.join('');

export const capitalize: ([...st]: readonly any[]) => any = ([...st]) =>
    st.map(str => capitalizeFirstLetter(str));
