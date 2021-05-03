import prisma from "./index";
import { ObscureEntry } from "../templates";
import { TelegramFormatting } from "../utils/formatting";
import { Prisma } from "@prisma/client";

export namespace TelegramInteraction {

    export function pushStaging(entry: ObscureEntry, user: User): Promise<{ id: number }> {
        return TermInteraction.pushStaging(entry, userValidate(user));
    }

    export function pushEntry(entry: ObscureEntry): Promise<{ id: number }> {
        return TermInteraction.pushEntry(entry);
    }

    export function userValidate(user: User): Prisma.usersCreateNestedOneWithoutStagingInput {
        return {
            connectOrCreate: {
                where: {
                    telegram_id: user.id,
                },
                create: {
                    telegram_id: user.id,
                    telegram_username: TelegramFormatting.formatUsername(user),
                },
            },
        };
    }

    export function termFeedback(connectedTerm: ObscureEntry, user: User): Promise<{ id: number }> {
        return TelemetryInteraction.termFeedback(connectedTerm, userValidate(user));
    }

    export function markUseless(e: { id: number }, message: { text?: string }): Promise<{ id: number }> {
        if(!message.text) {
            throw new Error();
        }
        return TelemetryInteraction.markUseless(e, message.text);
    }

    export function requestTerm(user: User, message: { text?: string }): Promise<{ id: number }> {
        if(!message.text) {
            throw new Error();
        }
        return TelemetryInteraction.requestTerm(userValidate(user), message.text);
    }

    export type User = {
        id: number;
        username?: string;
        first_name: string;
        last_name?: string
    }
}

export namespace TermInteraction {

    export function pushStaging(entry: ObscureEntry, user: Prisma.usersCreateNestedOneWithoutStagingInput): Promise<{ id: number }> {
        return prisma.staging.create({
            data: {
                term: entry.term,
                value: entry.value,
                users: user,
            },
            select: {
                id: true,
            },
        });
    }

    export function pushEntry(entry: ObscureEntry): Promise<{ id: number }> {
        return prisma.obscure.create({
            data: {
                term: entry.term,
                value: entry.value,
            },
            select: {
                id: true,
            },
        });
    }
}

export namespace TelemetryInteraction {

    export function termFeedback(connectedTerm: ObscureEntry, user: Prisma.usersCreateNestedOneWithoutStagingInput): Promise<{ id: number }> {
        return prisma.telemetry.create({
            data: {
                users: user,
                obscure: {
                    connect: {
                        id: connectedTerm.id,
                    },
                },
            },
            select: {
                id: true,
            },
        });
    }

    export function markUseful(e: { id: number }): Promise<{ id: number }> {
        return prisma.telemetry.update({
            where: e,
            data: {
                is_useful: true,
            },
            select: {
                id: true,
            },
        });
    }

    export function markUseless(e: { id: number }, text: string): Promise<{ id: number }> {
        return prisma.telemetry.update({
            where: e,
            data: {
                is_useful: false,
                origin_message: text,
            },
            select: {
                id: true,
            },
        });
    }
    
    export function requestTerm(user: Prisma.usersCreateNestedOneWithoutStagingInput, text: string): Promise<{ id: number }> {
        return prisma.telemetry.create({
            data: {
                is_useful: false,
                users: user,
                origin_message: text,
            },
            select: {
                id: true,
            },
        });
    }
}
