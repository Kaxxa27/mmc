# Деплой на Vercel (бесплатные планы)

Схема продакшена:

```
браузер ──▶ Vercel: веб (apps/web, Next.js) ──▶ Vercel: API (apps/api, NestJS) ──▶ Supabase Cloud
                                                                                  (Postgres, Auth, Storage)
```

Нужны аккаунты: **GitHub**, **Vercel** (Hobby), **Supabase** (Free), **Resend** (Free, SMTP для
писем), **TMDB** (бесплатный ключ API).

> Ниже используются имена проектов `my-movie-catalog-web` и `my-movie-catalog-api`, поэтому адреса
> будут `https://my-movie-catalog-web.vercel.app` и `https://my-movie-catalog-api.vercel.app`. Если
> имя занято, Vercel выдаст другой адрес — тогда подставляйте свои адреса везде, где они встречаются.

Порядок: **0** → **1** → **2** → **3** → **4** → **5** → **6**. Адреса веба и API нужны заранее,
поэтому сначала выберите имена проектов.

---

## 0. Код в GitHub

1. Смержите PR с подготовкой к деплою в `main` (Vercel делает production-деплой из `main`).

---

## 1. Ключ TMDB

1. themoviedb.org → **Settings → API** → создайте ключ.
2. Скопируйте **API Read Access Token** (длинный токен `eyJ...`) — это `TMDB_API_READ_ACCESS_TOKEN`.

Без ключа в продакшене mock-данные не используются: будут доступны только фильмы, уже сохранённые в
базе, без актёров, трейлеров и подборок.

---

## 2. Resend (почта)

Supabase без своего SMTP отправляет всего несколько писем в час, поэтому коды входа нужно слать через
свой SMTP.

1. resend.com → **API Keys** → **Create API Key** (права _Sending access_). Сохраните `re_...`.
2. **Domains → Add Domain** — добавьте свой домен и DNS-записи, которые покажет Resend, дождитесь
   статуса _Verified_.
   - Без своего домена можно отправлять только с `onboarding@resend.dev` и **только на адрес вашего
     аккаунта Resend** — для проверки этого хватит, для реальных пользователей нет.
3. SMTP-параметры (понадобятся дважды — в Supabase и в API):

| Параметр    | Значение                                                     |
| ----------- | ------------------------------------------------------------ |
| Host        | `smtp.resend.com`                                            |
| Port        | `465` (SSL)                                                  |
| User        | `resend`                                                     |
| Password    | ключ `re_...`                                                |
| Отправитель | `no-reply@ваш-домен` (или `onboarding@resend.dev` для теста) |

---

## 3. Supabase Cloud

### 3.1 Проект и миграции

1. supabase.com → **New project**. Регион поближе к пользователям (например, Frankfurt). Сохраните
   пароль базы данных.
2. В корне репозитория:

```bash
npx supabase login
npx supabase link --project-ref <REF>     # REF — из адреса проекта: https://supabase.com/dashboard/project/<REF>
npx supabase db push                      # создаст все таблицы, политики и функции
```

`supabase config push` **не запускайте**: в `supabase/config.toml` локальные настройки (адрес
`localhost`, локальная почта), они перезапишут облачные.

### 3.2 Authentication

**Authentication → Sign In / Providers → Email**

| Настройка             | Значение                                                     |
| --------------------- | ------------------------------------------------------------ |
| Enable Email provider | вкл.                                                         |
| Confirm email         | вкл.                                                         |
| Email OTP Length      | `6`                                                          |
| Email OTP Expiration  | `600` секунд (должно совпадать с `OTP_EXPIRY_SECONDS` в API) |

**Authentication → URL Configuration**

| Настройка     | Значение                                     |
| ------------- | -------------------------------------------- |
| Site URL      | `https://my-movie-catalog-web.vercel.app`    |
| Redirect URLs | `https://my-movie-catalog-web.vercel.app/**` |

**Authentication → Emails → SMTP Settings** — включите _Enable Custom SMTP_ и введите параметры
Resend из шага 2 (Sender email — ваш отправитель, Sender name — `My Movie Catalog`).

**Authentication → Emails → Templates** — шаблоны с кодом и ссылкой. Скопируйте тему и HTML из
репозитория целиком:

| Шаблон в панели | Тема (Subject)                                   | Тело (HTML)                            |
| --------------- | ------------------------------------------------ | -------------------------------------- |
| Confirm signup  | `Welcome to My Movie Catalog: your sign-in code` | `supabase/templates/confirmation.html` |
| Magic Link      | `Your My Movie Catalog sign-in code`             | `supabase/templates/magic_link.html`   |

Шаблоны выводят 6-значный код (`{{ .Token }}`) и ссылку
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` — её открывает страница веба
`/auth/confirm`. Стандартные шаблоны Supabase не подходят: в них нет кода, а ссылка ведёт мимо веба.

**Authentication → Rate Limits** — после подключения своего SMTP поднимите лимит _emails sent_ до
`100` в час. Запросы в Supabase Auth идут с серверов API, поэтому лимиты Supabase «на IP» общие для
всех пользователей: поднимите также _sign-ups and sign-ins_ и _token verifications_ (например, до
`300`).

### 3.3 Storage

**Storage → New bucket**:

| Настройка          | Значение                            |
| ------------------ | ----------------------------------- |
| Name               | `media`                             |
| Public bucket      | вкл.                                |
| File size limit    | `5 MB`                              |
| Allowed MIME types | `image/png, image/jpeg, image/webp` |

Здесь хранятся аватары, картинки групп и обложки коллекций.

### 3.4 Значения для API

| Где в панели Supabase                                                              | Переменная API                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Connect** (кнопка вверху) → **Transaction pooler** → URI, подставьте пароль базы | `DATABASE_URL` (порт `6543`)                                                                                                                            |
| **Project Settings → Data API** → Project URL                                      | `SUPABASE_URL`                                                                                                                                          |
| **Project Settings → API Keys** → Publishable key (`sb_publishable_...`)           | `SUPABASE_ANON_KEY`                                                                                                                                     |
| **Project Settings → API Keys** → Secret key (`sb_secret_...`)                     | `SUPABASE_SERVICE_ROLE_KEY`                                                                                                                             |
| **Project Settings → JWT Keys**                                                    | `SUPABASE_JWT_SECRET` — только если токены подписываются legacy-секретом (HS256); при асимметричных ключах оставьте пустым, API проверит токены по JWKS |

Для serverless нужен именно **Transaction pooler**: прямое подключение (порт 5432) быстро исчерпает
лимит соединений.

---

## 4. API на Vercel (`apps/api`)

1. vercel.com → **Add New… → Project** → импортируйте `Kaxxa27/test-claude`.
2. **Project Name**: `my-movie-catalog-api`.
3. **Root Directory**: `apps/api` (кнопка _Edit_).
4. **Framework Preset**: `Other`. Build Command / Output Directory не трогайте — они заданы в
   `apps/api/vercel.json`.
5. **Environment Variables** (вставьте блоком через _Paste .env_, заменив значения):

```env
NODE_ENV=production
TRUST_PROXY=true
LOG_FORMAT=json
WEB_APP_URL=https://my-movie-catalog-web.vercel.app
CORS_ORIGINS=https://my-movie-catalog-web.vercel.app
PUBLIC_API_URL=https://my-movie-catalog-api.vercel.app
SWAGGER_ENABLED=true
JOBS_ENABLED=false

DATABASE_URL=postgresql://postgres.<REF>:<ПАРОЛЬ>@aws-0-<регион>.pooler.supabase.com:6543/postgres
DATABASE_POOL_MAX=2

SUPABASE_URL=https://<REF>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=media

TMDB_API_READ_ACCESS_TOKEN=eyJ...
# Картинки TMDB через домен веба (image.tmdb.org заблокирован у части провайдеров)
TMDB_IMAGE_BASE_URL=https://my-movie-catalog-web.vercel.app/tmdb-images

SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=re_...
MAIL_FROM=My Movie Catalog <no-reply@ваш-домен>

OTP_EXPIRY_SECONDS=600
OTP_REQUESTS_PER_HOUR_PER_IP=300
OTP_VERIFICATIONS_PER_15_MIN_PER_IP=600
RATE_LIMIT_PER_MINUTE=3000
```

Почему подняты лимиты «на IP»: браузер обращается к API не напрямую, а через сервер веба, и Vercel
подставляет в `X-Forwarded-For` адрес этого сервера. Для API все пользователи выглядят как
несколько IP, поэтому локальные лимиты (30 запросов кода в час на IP) быстро сработали бы для всех
сразу. Лимиты на один email (`OTP_REQUESTS_PER_HOUR_PER_EMAIL`, попытки ввода кода) продолжают
работать как прежде.

Зачем `TMDB_IMAGE_BASE_URL`: постеры грузит браузер пользователя, а `image.tmdb.org` у части
провайдеров (особенно мобильных) заблокирован, и картинки не показываются. Веб проксирует
`/tmdb-images/*` на `https://image.tmdb.org/t/p/*` (`apps/web/next.config.ts`), поэтому браузеру
нужен только домен веба. Подставьте сюда реальный адрес веб-проекта.

6. **Deploy**.
7. Проверка: `https://my-movie-catalog-api.vercel.app/api/v1/health` должен вернуть `200`, а
   `https://my-movie-catalog-api.vercel.app/api/v1/movies/lists/popular` — список фильмов.

---

## 5. Веб на Vercel (`apps/web`)

1. **Add New… → Project** → тот же репозиторий.
2. **Project Name**: `my-movie-catalog-web`.
3. **Root Directory**: `apps/web`. **Framework Preset**: `Next.js` (определится сам).
4. **Environment Variables**:

```env
API_URL=https://my-movie-catalog-api.vercel.app
```

5. **Deploy**.

Токены пользователей живут в httpOnly-cookie на домене веба; браузер с API напрямую не общается
(кроме загрузки картинок).

---

## 6. Проверка после деплоя

1. Откройте `https://my-movie-catalog-web.vercel.app` — главная с подборками фильмов.
2. **Sign in** → введите свой email → придёт письмо с кодом → введите код → онбординг.
3. Откройте фильм, нажмите _Want to watch_ — он появится в **Watchlist**.
4. **Settings** → загрузите аватар (проверка Storage).
5. **Groups** → создайте группу → пригласите второй адрес по email (проверка SMTP из API) или по
   ссылке.
6. Ссылка из письма (`/auth/confirm`) тоже должна входить в аккаунт.

Если что-то не работает — **Vercel → проект → Logs** (у API логи в JSON).

| Симптом                                                      | Причина                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Веб: «The API is not reachable»                              | неверный `API_URL` или API не задеплоен                            |
| API `/health` не 200, ошибки подключения к базе              | `DATABASE_URL`: не pooler, не тот пароль или порт                  |
| Письмо с кодом не приходит                                   | SMTP в Supabase; без своего домена Resend шлёт только на ваш адрес |
| В письме нет кода / ссылка ведёт на localhost                | шаблоны (3.2) или Site URL не заменены                             |
| Код верный, но вход не проходит, `TOKEN_INVALID` в логах API | укажите `SUPABASE_JWT_SECRET`, если проект на legacy-ключах        |
| Загрузка аватара падает                                      | нет bucket `media` или он не публичный                             |

---

## Что отличается от локального запуска

- **Фоновые задачи не выполняются** (serverless-функции не работают постоянно): нет напоминаний о
  релизах из watchlist, неподтверждённые аккаунты не удаляются автоматически, старые записи
  лимитов не чистятся. Всё остальное работает.
- **Dev-инструменты выключены**: нет быстрого входа, демо-семьи и почтового ящика Mailpit — вход
  только по коду из письма.
- **Swagger UI** включён (`SWAGGER_ENABLED=true`) по адресу `/api/docs`; если в serverless-сборке
  не загрузятся его статические файлы, сама схема доступна по `/api/docs/openapi.json`. Чтобы
  спрятать документацию, поставьте `false`.
- **Ограничения бесплатных планов**: Vercel Hobby — только для некоммерческих проектов; бесплатный
  проект Supabase засыпает после недели без активности (просыпается кнопкой в панели); первый
  запрос к «остывшему» API занимает 1–3 секунды.
- **Свой домен**: после подключения домена в Vercel замените адреса в `WEB_APP_URL`,
  `CORS_ORIGINS`, `PUBLIC_API_URL`, `API_URL` и в настройках Supabase (Site URL, Redirect URLs).

## Что изменено в коде для Vercel

- `apps/api/src/serverless.ts` + `apps/api/api/index.js` — API как одна serverless-функция: Nest
  поднимается один раз на экземпляр функции и обслуживает все маршруты.
- `apps/api/vercel.json` — сборка `nest build` и перенаправление всех путей в функцию.
- `apps/api/src/app.module.ts` — на Vercel (`VERCEL=1`) планировщик задач не запускается.
- `apps/web/vercel.json` — явный пресет Next.js.
