# Obscure Slang Translator

A little educational project. Telegram bot that translate stranger Russian slang to human language

[![time tracker](https://wakatime.com/badge/github/ijo42/ObscureSlangTranslator.svg)](https://wakatime.com/badge/github/ijo42/ObscureSlangTranslator)

Up-to-date information is available in [News Public](https://t.me/obscurenews)

## Stack:

* Node.JS
* TypeScript
* PostgreSQL
* Docker
* Node's Telegram Bot API
* Fuse.JS
* Prisma

I love java, but sometimes I want some variety... sorry for the bleeding eyes

## Image-Variants

|                Tags | Description                                                  |
| ------------------: | ------------------------------------------------------------ |
|            `latest` | Using the `latest` tag will pull the latest release image    |
|            `master` | Using the `master` tag will pull latest master-branch image  |
| `sha-([a-z0-9]{7})` | Using this tag will push image based on relevant git-commit `(sha-155fc99)` |
|             `#.#.#` | Using this tag will push relevant Release `(1.1.0)`          |

------

## Deployment:

I strongly urge you to use Docker

*using docker-compose:*

1. create bot-account via [BotFather](https://telegram.me/BotFather)
2. create `.env` file. like this:

```
PGHOST=obscure_db
PGUSER=root
PGDATABASE=postgres
PGPASSWORD=****
#PGPORT=5432 # Only if need map to global network

DEBUG=false
TELEGRAM_TOKEN=****
```

3. create `docker-compose.yml` file. like this:

 ```
version: "2"

services:
  bot:
    image: ijo42/obscureslangtranslator:latest
    restart: always
    depends_on:
      - db
    environment:
      DB_URL: postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:5432/${PGDATABASE}?schema=public
      DEBUG: ${DEBUG}
      TELEGRAM_TOKEN: ${TELEGRAM_TOKEN}
  db:
    image: postgres:latest
    container_name: ${PGHOST}
    restart: always
   # ports:             # Only if need map to global network
   #   - ${PGPORT}:5432
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: ${PGUSER}
      POSTGRES_PASSWORD: ${PGPASSWORD}
      POSTGRES_DB: ${PGDATABASE}

volumes:
  db_data:
 ```

4. start via `docker-compose up -d`
5. (optional) setup moderator's rights via console-instructions

## License

As described in [LICENSE](https://github.com/ijo42/ObscureSlangTranslator/blob/master/LICENSE), MPL-2.0 used

I also try to stick to [Semantic Versioning](https://semver.org/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

