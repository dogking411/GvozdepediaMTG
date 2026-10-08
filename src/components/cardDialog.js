import { marked } from 'marked';
import { manaSymbols } from '../lib/scryfall.js';
import { esc } from '../lib/html.js';

const oracle = (text) => manaSymbols(esc(text)).replace(/\n/g, '<br>');

/**
 * Окно с подробностями о карте из коллекции.
 * Для редактора — правка заметки и удаление (onSave(note), onRemove() возвращают промисы).
 */
export function openCardDialog({ entry, card, editor, onSave, onRemove }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog card-dialog';
  const added = entry.added ? new Date(entry.added).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  dialog.innerHTML = `
    <button class="icon-btn dialog-close" aria-label="Закрыть">✕</button>
    <div class="card-dialog-body">
      <div class="card-dialog-images">
        ${card?.image ? `<img src="${esc(card.image)}" alt="${esc(entry.name)}">` : ''}
        ${card?.backImage ? `<img src="${esc(card.backImage)}" alt="">` : ''}
      </div>
      <div class="card-dialog-info">
        <h2>${esc(entry.name)} <span class="cost">${manaSymbols(card?.manaCost)}</span></h2>
        ${card ? `<p class="muted">${esc(card.typeLine)}</p>` : ''}
        ${card?.text ? `<div class="oracle">${oracle(card.text)}</div>` : ''}

        <h4>Чем нравится</h4>
        ${
          editor
            ? `<textarea class="note-input" rows="5" placeholder="Пара слов, чтобы не забыть, чем карта зацепила">${esc(entry.note || '')}</textarea>`
            : `<div class="prose">${entry.note ? marked.parse(entry.note) : '<p class="muted">Без заметки.</p>'}</div>`
        }
        ${added ? `<p class="muted small">Добавлена ${added}</p>` : ''}
        <p class="error" hidden></p>

        <div class="form-actions">
          ${card?.url ? `<a class="btn" href="${esc(card.url)}" target="_blank" rel="noopener">Scryfall ↗</a>` : ''}
          ${
            editor
              ? `<button class="btn btn-danger" data-act="remove">Убрать</button>
                 <button class="btn btn-primary" data-act="save">Сохранить заметку</button>`
              : ''
          }
        </div>
      </div>
    </div>
  `;
  document.body.append(dialog);

  const error = dialog.querySelector('.error');
  const run = async (button, label, action) => {
    error.hidden = true;
    button.disabled = true;
    const text = button.textContent;
    button.textContent = label;
    try {
      await action();
      dialog.close();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      button.disabled = false;
      button.textContent = text;
    }
  };

  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close()); // клик по фону
  dialog.addEventListener('close', () => dialog.remove());

  const save = dialog.querySelector('[data-act="save"]');
  save?.addEventListener('click', () => run(save, 'Сохраняю…', () => onSave(dialog.querySelector('.note-input').value.trim())));

  const remove = dialog.querySelector('[data-act="remove"]');
  remove?.addEventListener('click', () => {
    if (confirm(`Убрать «${entry.name}» из крутых карт?`)) run(remove, 'Убираю…', onRemove);
  });

  dialog.showModal();
}
