export default function build(command: string, args: string | undefined = undefined) {
    if (!args)
        return new RegExp(`^\/${command}(?:${baseRegexp.botMention})?$`)
    return new RegExp(`^\/${command}(?:${baseRegexp.botMention})? ${args}$`)
}

const baseRegexp = {
    mention: "@[a-zA-Z0-9_]{5,}",
    botMention: "@[a-zA-Z0-9_]{5,}_bot"
}