import prisma from "./index";
import { TelegramFormatting } from "../utils/formatting";
import { hasRights } from "../telegram/moderate";
type moderatorType = Prisma.moderatorsCreateNestedOneWithoutStagingInput;

import { obscure, Prisma, users } from "@prisma/client";
type defaultPromise = Promise<{ id: number }>;
type userType = Prisma.usersCreateNestedOneWithoutStagingInput;

export namespace TelegramInteraction {

    export function pushStaging(entry: obscure, user: User): defaultPromise {
        return TermInteraction.pushStaging(entry, userValidate(user));
    }

    export function pushEntry(entry: obscure): defaultPromise {
        return TermInteraction.pushEntry(entry);
    }

    export function userValidate(user: User): userType {
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

    export function termFeedback(connectedTerm: obscure, user: User): defaultPromise {
        return TelemetryInteraction.termFeedback(connectedTerm, userValidate(user));
    }

    export function markUseless(e: { id: number }, message: { text?: string }): defaultPromise {
        if(!message.text) {
            throw new Error();
        }
        return TelemetryInteraction.markUseless(e, message.text);
    }

    export function requestTerm(user: User, message: { text?: string }): defaultPromise {
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

    export function pushStaging(entry: obscure, user: userType): defaultPromise {
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

    export function pushEntry(entry: obscure): defaultPromise {
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

    export function deleteTerm(obscureTerm: obscure): Promise<Record<string, never>> {
        return prisma.obscure.delete({
            where: obscureTerm,
            select: {},
        });
    }
}

export namespace TelemetryInteraction {

    export function termFeedback(connectedTerm: obscure, user: userType): defaultPromise {
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

    export function markUseful(e: { id: number }): defaultPromise {
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

    export function markUseless(e: { id: number }, text: string): defaultPromise {
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
    
    export function requestTerm(user: userType, text: string): defaultPromise {
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

    export function collectTelemetry(uID?: number): Promise<{ id: number; obscure: obscure | null; is_useful: boolean | null; origin_message: string | null; } | null> {
        return prisma.telemetry.findFirst({
            where: {
                moderated_by: null,
                is_useful: false,
            },
            select: {
                id: true,
                is_useful: true,
                origin_message: true,
                obscure: true,
            },
            skip: uID ? 1 : undefined,
            cursor: uID ? {
                id: uID,
            } : undefined,
        });
    }

}

export namespace StagingInteraction {

    export function getStaging(): Promise<{ id: number; term: string; value: string; users: users; } | null> {
        return prisma.staging.findFirst({
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
        });
    }
}
