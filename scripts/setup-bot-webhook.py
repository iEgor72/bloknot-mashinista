#!/usr/bin/env python3
"""
Run on VPS: python3 scripts/setup-bot-webhook.py
Registers webhook, updates bot descriptions and the menu button, and removes legacy commands.
Reads TELEGRAM_BOT_TOKEN from .env file.
"""
import urllib.request, urllib.parse, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT, '.env')

def load_env():
    if not os.path.exists(ENV_FILE):
        return
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip(); v = v.strip().strip('"\'')
            if k not in os.environ:
                os.environ[k] = v

load_env()

TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
if not TOKEN:
    print('ERROR: TELEGRAM_BOT_TOKEN not found in env or .env file')
    sys.exit(1)

WEBHOOK_SECRET = os.environ.get('TELEGRAM_WEBHOOK_SECRET', '').strip()
APP_RELEASE_VERSION = 'v401'
APP_URL = 'https://bloknot-mashinista-bot.ru'
TELEGRAM_APP_URL = f'{APP_URL}/?app={APP_RELEASE_VERSION}'
WEBHOOK_URL = f'{APP_URL}/api/telegram-webhook'

def tg(method, payload=None):
    url = f'https://api.telegram.org/bot{TOKEN}/{method}'
    data = json.dumps(payload or {}).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as r:
        result = json.loads(r.read())
    ok = result.get('ok', False)
    print(f'  {"OK" if ok else "FAIL"} {method}: {json.dumps(result.get("result") or result.get("description") or result)[:120]}')
    return result

def set_menu_button():
    return tg('setChatMenuButton', {
        'menu_button': {
            'type': 'web_app',
            'text': 'Открыть',
            'web_app': {'url': TELEGRAM_APP_URL},
        }
    })

def clear_commands():
    return tg('deleteMyCommands', {})

def set_bot_copy():
    description = tg('setMyDescription', {
        'description': (
            'Рабочий журнал машиниста: смены, часы, календарь, документы '
            'и режим «Поехали». Примерный заработок — на главной.'
        ),
    })
    short_description = tg('setMyShortDescription', {
        'short_description': 'Смены, часы, календарь, документы и «Поехали».',
    })
    return description, short_description

if '--menu-only' in sys.argv:
    print(f'Updating Telegram bot copy and menu button to {APP_RELEASE_VERSION}, then clearing commands...')
    menu_result = set_menu_button()
    commands_result = clear_commands()
    description_result, short_description_result = set_bot_copy()
    sys.exit(0 if all(result.get('ok') for result in (
        menu_result,
        commands_result,
        description_result,
        short_description_result,
    )) else 1)

print('=== Setting up Telegram bot ===\n')

print('1. Deleting old webhook...')
tg('deleteWebhook', {'drop_pending_updates': True})

print('2. Setting webhook...')
set_webhook_payload = {
    'url': WEBHOOK_URL,
    'allowed_updates': ['message'],
    'drop_pending_updates': True,
}
if WEBHOOK_SECRET:
    set_webhook_payload['secret_token'] = WEBHOOK_SECRET

tg('setWebhook', set_webhook_payload)

print('3. Verifying webhook info...')
tg('getWebhookInfo')

print('4. Setting menu button (mini-app)...')
set_menu_button()

print('5. Removing bot commands...')
clear_commands()

print('6. Updating bot descriptions...')
set_bot_copy()

print('\nDone.')
