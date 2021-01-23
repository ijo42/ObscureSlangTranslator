const util = require("util");
const authorFieldLimit = 32;

export function formatUsername(user) {
    return util.format('%s <%i>', (user.username ||
        util.format('%s %s', user.first_name, user.last_name || '-'))
            .substring(0, authorFieldLimit-user.id.length-3), //DB Limit - two parentheses - space - ID length
        user.id);
}
