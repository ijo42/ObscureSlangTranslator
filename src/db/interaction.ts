import prisma from "./index";
import { ObscureEntry } from "../templates";
import { formatUsername } from "../utils/formatting";

export function pushStaging(entry: ObscureEntry, user: User): Promise<{ id: number }> {
    return prisma.staging.create({
        data: {
            term: entry.term,
            value: entry.value,
            users: {
                connectOrCreate: {
                    where: {
                        telegram_id: user.id,
                    },
                    create: {
                        telegram_id: user.id,
                        telegram_username: formatUsername(user),
                    },
                },
            },
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

export function userValidate(user: User): { connectOrCreate: { create: { telegram_username: string; telegram_id: number }; where: { telegram_id: number } } } {
    return {
        connectOrCreate: {
            where: {
                telegram_id: user.id,
            },
            create: {
                telegram_id: user.id,
                telegram_username: formatUsername(user),
            },
        },
    };
}

export type User = {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string
}