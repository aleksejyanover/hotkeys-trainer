# Contributing / Участие в проекте

Спасибо за интерес к проекту! / Thanks for your interest in the project!

## Как внести вклад / How to contribute

1. Форкните репозиторий и создайте ветку для своей задачи:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Внесите изменения и убедитесь, что приложение запускается:
   ```bash
   npm install
   npm start
   npm test   # smoke-тест интерфейса
   ```
3. Опишите изменения в коммите (желательно на английском):
   ```bash
   git commit -m "Add: short description"
   ```
4. Откройте Pull Request.

## Руководство по стилям / Style guide

- Vanilla JS (ES modules), без фреймворков.
- Все новые сочетания клавиш добавляются в `src/data.js` с переводом `ru` и `en`.
- Все новые строки интерфейса добавляются в `src/i18n.js` для обоих языков.
- Поддерживайте паритет платформ: каждое сочетание должно иметь `mac` и/или `win`.

## Сообщество / Code of conduct

Будьте вежливы и уважительно относитесь к другим участникам.
Be polite and respectful to other participants.
