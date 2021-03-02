import { bot } from "../app";
const text2png = require('text2png');

export function sendPic(id: number | string, term: string, value: string) {
    let photo: string = text2png(`${term} - ${value}`, {
        font: '80px Century',
        color: 'teal',
        backgroundColor: 'linen',
        lineSpacing: 10,
        padding: 20, output: 'dataURL'
    });
    return bot.sendPhoto(id, photo);
}