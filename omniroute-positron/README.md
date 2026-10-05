<div dir="rtl">

# OmniRoute + Positron: Fallback חלק, מי עונה עכשיו, וכמה מכסה נשארה

כלים לביצוע "תכנית עבודה: OmniRoute + Positron" (5 באוקטובר 2026). כולם מבוססים על מנגנונים שכבר קיימים ב-OmniRoute (גרסה 3.8.x), בלי לשנות את הקוד שלו.

## הסיבה האמיתית לכשל ב-4 באוקטובר (ממצא 1)

בדקתי בקוד המקור של OmniRoute, בקובץ `open-sse/services/combo/comboStructure.ts`:

- `filterTargetsByRequestCompatibility()` רץ **לפני** שנשלחת בקשה כלשהי. הוא פוסל כל מודל שה-`max_tokens` המבוקש גבוה מתקרת הפלט שלו (`output_tokens`). זו פסילה **"קשה"**.
- כל מודלי Antigravity (Opus 4.6, Sonnet 4.6, Gemini 3.1 Pro) רשומים בקטלוג עם תקרת פלט של **65,536**. Claude Code ביקש **128,000**.
- לכן השרשרת `my-pro-fallback` הצטמצמה ל-Opus 5.5 בלבד. כשהמכסה שלו נגמרה לא נשאר אף מודל, והתוצאה הייתה 503.
- למנגנון ה"גיבוי האחרון" (#6238), שמנסה בכל זאת מודלים שנפסלו, יש מגבלה: הוא קיים רק ב-combo מסוג round-robin ולא ב-priority.
- **גודל השיחה לא היה הבעיה.** כל שלושת מודלי הגיבוי רשומים עם context של 1,048,576 טוקנים, כך ששיחה של 227 אלף נכנסת בלי בעיה. `contextFilterMode` משפיע רק כשה-combo מגדיר `minContextWindow`, וברירת המחדל שלו היא כבר `lenient`. **שלב 1ג לא נחוץ.**

**התיקון:** `CLAUDE_CODE_MAX_OUTPUT_TOKENS=32000` (שלב 1א). זה מתחת לתקרה של כל המודלים בשרשרת.

עוד שני דברים שאישרתי בקוד:
- Opus 4.6 ו-Sonnet 4.6 ב-Antigravity חולקים באמת חלון מכסה אחד (`claude_gpt_weekly`). ל-Gemini יש חלון נפרד (`gemini_weekly`).
- `gemini-3.1-pro-high` נשלח בפועל כ-`gemini-pro-agent`, ולכן זה השם שיופיע ב-`call_logs`. הכלים כאן יודעים לזהות את שני השמות.

## איך יודעים מי עונה ומה המכסה (מטרות 2 ו-3)

| מה | המנגנון הקיים ב-OmniRoute |
|---|---|
| מי ענה על בקשה | הטבלה `call_logs` (`provider`, `model`, `combo_step_id`), וגם הכותרות `X-OmniRoute-Model`, `X-OmniRoute-Provider` ו-`X-OmniRoute-Fallback-Attempts` בכל תשובה |
| מכסה שנותרה | המטמון `providerLimitsCache` בטבלה `key_value`. אלה אותם נתונים שמוצגים בדף Provider Limits בלוח הבקרה, והם מתעדכנים אוטומטית. לרענון ידני: `POST /api/usage/provider-limits` |

## הקבצים

| קובץ | שלב בתכנית | מה הוא עושה |
|---|---|---|
| `scripts/00-backup.sh` | 0א | גיבוי של 7 הקבצים |
| `scripts/01-fix-fallback.sh` | 1א | מוסיף `CLAUDE_CODE_MAX_OUTPUT_TOKENS=32000` ל-`~/.claude/settings.json` |
| `scripts/02-verify.sh` | 2 + בדיקות | בודק את ההגדרות, את סדר השרשרת, את הפורט, את ה-503 האחרונים ואת המכסות, ושולח בקשה חיה דרך ה-combo |
| `scripts/03-harden.sh` | 3 | מגדיר `OMNIROUTE_SERVER_HOST=127.0.0.1` ומפעיל מחדש את OmniRoute |
| `scripts/04-cleanup.sh` | 0ב | ניקוי המערכת הישנה. ברירת המחדל היא dry-run. שום דבר לא נמחק, הכל מועבר לתיקיית הגיבוי |
| `scripts/05-install-extension.sh` | 4 | מתקין את שורת הסטטוס החדשה (1.2.0) ומעביר הצידה גרסאות קודמות |
| `bin/omni-status.js` | 4 | אותו מידע בטרמינל. `--line` מדפיס שורה אחת |
| `extension/` | 4 | תוסף שורת הסטטוס ל-Positron |

## סדר ביצוע (על ה-Mac)

```bash
cd omniroute-positron
chmod +x scripts/*.sh

./scripts/00-backup.sh                 # 0א
./scripts/01-fix-fallback.sh           # 1א  ← ואז לסגור ולפתוח את Claude Code ב-Positron
#   1ב: בלוח הבקרה ← Combos ← my-pro-fallback, להוסיף את agy/claude-sonnet-4-6 כשלב 3
./scripts/02-verify.sh --no-live       # הבדיקות צריכות לעבור, חוץ מהפורט (שלב 3)
```

### שלב 2: ניסוי מבוקר

1. בלוח הבקרה: Providers ← claude ← **Inactive**.
2. `./scripts/02-verify.sh --regression`
   - בבקשה עם `max_tokens=32000` מצפים ל-HTTP 200 ול-`X-OmniRoute-Model: claude-opus-4-6-thinking`.
   - בבקשה עם `max_tokens=128000` מצפים לכשל. זה הבאג המקורי, והוא מוכיח שהתיקון הוא מה שעושה את ההבדל.
3. ב-Positron: "כתוב שלום". שורת הסטטוס צריכה להפוך לצהובה ולהציג `⚠️ גיבוי 2/4: Opus 4.6`.
4. שיחה ארוכה (יותר מ-200 אלף טוקנים): לוודא שאין 503 (סעיף 5 בסקריפט).
5. לכבות את `agy/claude-opus-4-6-thinking` בשרשרת, ולוודא שהתשובה עוברת ל-Sonnet ואז ל-Gemini (`node bin/omni-status.js`).
6. **להחזיר את claude למצב Active.** בבקשה הבאה הבר אמור להפוך לירוק ולהציג הודעה שחזרנו למודל הראשי.

### שאר השלבים

```bash
./scripts/04-cleanup.sh                # 0ב: קודם לקרוא מה הוא יעשה
#   אם Claude Desktop משתמש בפורט 9100:  KEEP_DESKTOP_PROXY=1 ./scripts/04-cleanup.sh --apply
./scripts/04-cleanup.sh --apply
./scripts/03-harden.sh                 # 3, ואז להדליק את חומת האש ידנית
./scripts/05-install-extension.sh      # 4, ואז Developer: Reload Window
./scripts/02-verify.sh                 # בדיקה סופית
```

## שורת הסטטוס החדשה

| מצב | תצוגה | צבע |
|---|---|---|
| המודל הראשי עונה | `✓ Opus 5.5 · Claude 3%` | רגיל |
| מודל גיבוי עונה | `⚠ גיבוי 3/4: Sonnet 4.6 · Claude 0%` | צהוב, עם הודעה קופצת במעבר |
| ה-combo נכשל (5xx) | `⊗ OmniRoute 503 · Claude 0%` | אדום |

- **Tooltip:** כל השרשרת עם סימון ▶ על המודל הפעיל, הבקשה האחרונה, מספר כשלי 5xx בעשר הדקות האחרונות, וכל חלונות המכסה עם זמן האיפוס.
- **התראה** כשמכסת Claude יורדת מתחת ל-10% (אפשר לשנות ב-`omniroute.lowQuotaPercent`).
- **תיקונים לעומת 1.0.x:** קריאה ב-`-readonly` בלבד. לא יוצא תהליך sqlite חדש לפני שהקודם סיים, כך שתהליכים לא מצטברים. כשלון 429 בודד של Claude באמצע מעבר לגיבוי לא צובע את הבר באדום.
- **הגדרות:** `omniroute.comboName`, `omniroute.refreshSeconds`, `omniroute.dbPath`, `omniroute.dashboardUrl`.

אפשר גם לקבל שורה אחת ב-Claude Code CLI (statusLine) דרך `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "node /path/to/omniroute-positron/bin/omni-status.js --line" }
```

## חזרה אחורה

כל הקבצים המקוריים נמצאים ב-`~/omniroute-backup-YYYY-MM-DD/`. כדי לחזור:

1. להעתיק אותם בחזרה למקומם.
2. ל-LaunchAgents: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/<name>.plist`.
3. לתיקון 1א: למחוק את השורה `CLAUDE_CODE_MAX_OUTPUT_TOKENS`.

</div>
