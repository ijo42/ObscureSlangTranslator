import { bot } from "../app";
import Jimp from "jimp";
import { ObscureEntry } from "../templates";

export function sendPic(id: number | string, entry: ObscureEntry) {
    Jimp.create("resources/template.png").then(image => {
        Jimp.loadFont("resources/CourierNew.fnt").then(font => {
            image.print(font, 0, image.getHeight() / 10, {
                text: entry.term,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_TOP
            }, image.getWidth());

            image.print(font, 0, image.getHeight() / 3, {
                text: entry.value,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
            }, image.getWidth());
            image.getBufferAsync(Jimp.MIME_PNG).then(i => bot.sendPhoto(id, i))
        });
    })
}