import Jimp from "jimp";
import { Font } from "@jimp/plugin-print";
import { obscure } from "@prisma/client";
import { Metrics } from "../metrics";

let template!: Jimp;
let titleFont!: Font;
let bodyFont!: Font;
let additionalFont!: Font;

export default async function setup(): Promise<void> {
    await Promise.all([
        Jimp.loadFont("resources/title.fnt"),
        Jimp.loadFont("resources/body.fnt"),
        Jimp.loadFont("resources/additional.fnt"),
        Jimp.create("resources/template.png"),
    ])
        .then(([title, body, additional, templatePromise]) => {
            titleFont = title;
            bodyFont = body;
            additionalFont = additional;
            template = templatePromise;
        });
}

export function genPic(entry: obscure): Promise<Buffer> {
    const timer = Metrics.renderDurationMicroseconds.startTimer();
    return Jimp.create(template)
        .then(image => image
            .print(titleFont, 0, image.getHeight() / 8, {
                text: entry.term,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_TOP,
            }, image.getWidth())

            .print(bodyFont, 0, image.getHeight() / 2.5, {
                text: entry.value,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
            }, image.getWidth())

            .print(additionalFont, -10, 10, {
                text: `#${entry.id}`,
                alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT,
            }, image.getWidth())
            .getBufferAsync(Jimp.MIME_PNG))
        .then(buff => {
            timer({ code: 200 });
            return buff;
        });
}