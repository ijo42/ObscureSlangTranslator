import Jimp from "jimp";
import { Font } from "@jimp/plugin-print";
import { obscure } from "@prisma/client";

let template!: Jimp;
let titleFont!: Font;
let bodyFont!: Font;
let additionalFont!: Font;

export default async function setup(): Promise<void> {
    Jimp.loadFont("resources/title.fnt")
        .then(x => titleFont = x);
    Jimp.loadFont("resources/body.fnt")
        .then(x => bodyFont = x);
    Jimp.loadFont("resources/additional.fnt")
        .then(x => additionalFont = x);
    await Jimp.create("resources/template.png")
        .then(x => template = x);
}

export function genPic(entry: obscure): Promise<Buffer> {
    return Jimp.create(template)
        .then(image => {
            image
                .print(titleFont, 0, image.getHeight() / 10, {
                    text: entry.term,
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
                }, image.getWidth())

                .print(bodyFont, 0, image.getHeight() / 3, {
                    text: entry.value,
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
                }, image.getWidth())

                .print(additionalFont, -10, 10, {
                    text: `#${entry.id}`,
                    alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT,
                }, image.getWidth());

            return image.getBufferAsync(Jimp.MIME_PNG);
        });
}