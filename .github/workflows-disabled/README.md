# GitHub Actions workflows (отключены)

Файлы `ci.yml` и `release.yml` лежат здесь, потому что GitHub **блокирует**
push/API-записи файлов в `.github/workflows/` без OAuth-scope `workflow`,
а автоматизация должна была настроиться без участия владельца.

## Как включить (одна команда)

```bash
gh auth refresh -h github.com -s workflow   # откроется браузер, ввести код
mkdir -p .github/workflows
mv .github/workflows-disabled/*.yml .github/workflows/
rmdir .github/workflows-disabled
git add -A && git commit -m "Enable CI workflows" && git push
```

После этого:

- **CI** (`ci.yml`) будет запускать `npm run validate` и smoke-тест на каждом push;
- **Build apps** (`release.yml`) собирает macOS `.dmg` и Windows `.exe`
  ( Actions → Build apps → Run workflow ), артефакты — в результатах запуска.
