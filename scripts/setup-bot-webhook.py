#!/usr/bin/env python3
"""
Run on VPS: python3 scripts/setup-bot-webhook.py
Registers webhook, sets menu button, sets commands.
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

APP_URL = 'https://bloknot-mashinista-bot.ru'
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

print('=== Setting up Telegram bot ===\n')

print('1. Deleting old webhook...')
tg('deleteWebhook', {'drop_pending_updates': True})

print('2. Setting webhook...')
tg('setWebhook', {
    'url': WEBHOOK_URL,
    'allowed_updates': ['message'],
    'drop_pending_updates': True,
})

print('3. Verifying webhook info...')
tg('getWebhookInfo')

print('4. Setting menu button (mini-app)...')
tg('setChatMenuButton', {
    'menu_button': {
        'type': 'web_app',
        'text': 'Открыть',
        'web_app': {'url': APP_URL},
    }
})

print('5. Setting bot commands...')
tg('setMyCommands', {
    'commands': [
        {'command': 'start', 'description': 'Открыть мини-апп'},
        {'command': 'help',  'description': 'Помощь'},
    ]
})

print('\nDone.')
