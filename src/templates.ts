import prisma from "./db";

export interface ObscureEntry {
    id: number;
    term: string;
    value: string;
    synonyms: string[];
}

export function collectTelemetry(uID?: number): Promise<{ obscure: ObscureEntry | null; id: number; is_useful: boolean | null; origin_message: string | null } | null> {
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
