export const texts = {
    dbSize: 'Currently, DB contains %s terms',
    welcome: 'Welcome, available commands: /size'
}
export const queries = {
    insertTerm: 'INSERT INTO obscure(term, value, author) VALUES($1, $2, $3) RETURNING *',
    lastIndex: 'SELECT max(id) FROM obscure'
}
export const commands = {
    add: {
        regexp: /^(\/add )?([a-zA-Z0-9_а-яА-Я]+)(?:(?:\s?-\s?)|\s+)([a-zA-Z0-9_а-яА-Я,. ]+)$/,
        desk: 'Main upload command'
    },
    size: {
        regexp: /\/size$/,
        desk: 'Get last DB index'
    },
    start: {
        regexp: /\/start/,
        desk: 'Welcome-Command'
    }
}