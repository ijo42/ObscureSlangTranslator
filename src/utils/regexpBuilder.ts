export default function build(command: string, args: string | undefined = undefined): RegExp {
    if (!args)
        return new RegExp(`^/${command}(?:${baseRegexp.botMention})?$`);
    return new RegExp(`^/${command}(?:${baseRegexp.botMention})? ${args}$`);
}

export const baseRegexp = {
    mention: "@[a-zA-Z0-9_]{5,}",
    botMention: "@[a-zA-Z0-9_]{5,}_bot",
    searchableExp: "([a-zA-Zа-яА-ЯёЁ0-9_ ]+)",
    categoryDef: "[a-zA-Zа-яА-ЯёЁ0-9_]+",
    fullMatch: "([a-zA-Zа-яА-ЯёЁ0-9_]{2,}) - ([a-zA-Zа-яА-ЯёЁ0-9_,.)( -]{2,})",
    lazyMatch: "([a-zA-Zа-яА-ЯёЁ0-9_]{2,})(?:(?: ?- ?)| +)([a-zA-Zа-яА-ЯёЁ0-9_,.)( -]{2,})"
};

export const compiledRegexp = {
    mention: new RegExp(baseRegexp.mention),
    botMention: new RegExp(baseRegexp.botMention),
    searchableExp: new RegExp(baseRegexp.searchableExp),
    categoryDef: new RegExp(baseRegexp.categoryDef),
    fullMatch: new RegExp(baseRegexp.fullMatch),
    lazyMatch: new RegExp(baseRegexp.lazyMatch),
};