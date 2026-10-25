// Закладка «→ Gvozdepedia» для страницы колоды на Moxfield.
// Выполняется в браузере редактора на moxfield.com: забирает колоду так же, как это делает сам сайт Moxfield,
// и открывает Gvozdepedia (#/import/<id>/<текст>) с готовым списком изменений.
//
// Функция превращается в ссылку javascript: — внутри нельзя использовать ничего снаружи, кроме аргумента site.
function moxfieldToGvozdepedia(site) {
  const id = location.pathname.match(/\/decks\/([\w-]+)/)?.[1];
  if (!/(^|\.)moxfield\.com$/.test(location.hostname) || !id) {
    alert('Открой страницу своей колоды на Moxfield и нажми закладку ещё раз.');
    return;
  }
  // Вкладку открываем сразу, иначе браузер посчитает её всплывающим окном
  const tab = window.open('', '_blank');
  fetch(`https://api2.moxfield.com/v3/decks/all/${id}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Moxfield ответил ${res.status}`);
      return res.json();
    })
    .then((mox) => {
      const name = (e, flavor) => ((flavor && e.card.flavor_name) || e.card.name).replace(/\s+\/\/\s+/g, ' / ');
      const finish = (e) => (e.finish === 'foil' ? ' *F*' : e.finish === 'etched' ? ' *E*' : '');
      const board = (b, flavor) =>
        Object.values(mox.boards?.[b]?.cards || {})
          .sort((x, y) => name(x, flavor).localeCompare(name(y, flavor)))
          .map((e) => `${e.quantity} ${name(e, flavor)} (${e.card.set.toUpperCase()}) ${e.card.cn}${finish(e)}`);
      const text = [
        'Commander', ...board('commanders', false), '',
        'Deck', ...board('mainboard', true), '',
        'Sideboard', ...board('sideboard', true),
      ].join('\n');
      const url = `${site}#/import/${id}/${encodeURIComponent(text)}`;
      if (tab) tab.location.href = url;
      else location.href = url;
    })
    .catch((err) => {
      tab?.close();
      alert(`Не получилось забрать колоду: ${err.message}`);
    });
}

/** Ссылка javascript: для панели закладок. */
export function bookmarkletHref() {
  const site = location.origin + location.pathname;
  // Кодируем целиком: иначе браузер при сохранении закладки может склеить строки кода
  const code = `(${moxfieldToGvozdepedia.toString()})(${JSON.stringify(site)});void 0`;
  return `javascript:${encodeURIComponent(code)}`;
}
