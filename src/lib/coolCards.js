import { getSession } from './auth.js';
import { getFile, putFile } from './github.js';
import { setPending } from './content.js';
import { COOL_CARDS_FILE } from '../config.js';

export const sameCard = (a, b) => a.toLowerCase() === b.toLowerCase();
export const today = () => new Date().toISOString().slice(0, 10);

/**
 * Изменяет content/cards.json на GitHub: берёт свежую версию файла,
 * применяет mutate(list) и коммитит. Если файл успели изменить с другого
 * устройства — повторяет один раз уже поверх новой версии.
 */
export async function updateCoolCards(mutate, message) {
  const session = getSession();
  for (let attempt = 0; ; attempt++) {
    const file = await getFile(session, COOL_CARDS_FILE);
    let list = [];
    try {
      list = file ? JSON.parse(file.text) : [];
    } catch {
      /* битый файл — начинаем с пустого списка */
    }
    const text = JSON.stringify(mutate(list), null, 2) + '\n';
    try {
      await putFile(session, COOL_CARDS_FILE, text, message, file?.sha);
      setPending(COOL_CARDS_FILE, text);
      return;
    } catch (err) {
      if (err.status !== 409 || attempt > 0) throw err;
    }
  }
}
