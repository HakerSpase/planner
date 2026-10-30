# Planner для Android

Нативная обёртка (Capacitor 8) вокруг https://mplanner-dun.vercel.app: интерфейс тот же,
что на сайте, и каждое обновление сайта сразу видно в приложении — пересобирать не нужно.

## Что даёт приложение сверх сайта

| | |
|---|---|
| Вход через Google | идёт во вкладке Chrome и возвращается в приложение (`app.mplanner.planner://auth`) — Google не пускает в WebView |
| Напоминания | ставятся в Android и приходят, даже когда приложение закрыто |
| «Поделиться → Planner» | текст или ссылка из любого приложения → поле быстрой задачи |
| Озвучка | системный движок Android, русский/английский по языку фразы |
| Дыхание | экран не гаснет, вибрация на смене фаз |
| Без сети | своя страница «Нет подключения» с автоповтором |

## Сборка

APK собирает GitHub Actions (`.github/workflows/android.yml`) при изменениях в `android-app/`
или вручную: Actions → Android APK → Run workflow. Готовый файл — в Releases → «Planner для Android».

Нужны два секрета репозитория (Settings → Secrets and variables → Actions):

- `ANDROID_KEYSTORE_BASE64` — ключ подписи в base64;
- `ANDROID_KEYSTORE_PASSWORD` — пароль к нему.

Ключ лежит вне репозитория (`../../android-signing/`). **Не теряйте его**: без того же ключа
новая версия не встанет поверх старой.

Локально (нужны JDK 21 и Android SDK): `npm ci && npx cap sync android && cd android && ./gradlew assembleRelease`.
