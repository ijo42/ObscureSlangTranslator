import { CallbackQuery, Message } from "node-telegram-bot-api";
import { Keyboard } from "./templates";

const registeredCallbacks = new Map<number, Keyboard>();

export const registerCallback = (message: Message, callback: Keyboard) => {
    registeredCallbacks.set(message.message_id, callback);
};

export const processQuery = (query: CallbackQuery) => {
    if (query.message && "reply_markup" in query.message) {
        registeredCallbacks.get(query.message.message_id)?.inline_keyboard.forEach(
            value =>
                value.find(val =>
                    val.callback_data == query.data)?.callback(query));
        registeredCallbacks.delete(query.message.message_id);
    }
}