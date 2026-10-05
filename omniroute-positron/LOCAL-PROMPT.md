משימה: לבצע על המחשב הזה את "תכנית עבודה: OmniRoute + Positron", ולוודא שה-Fallback עובד בצורה חלקה.

## המטרות
1. כשמכסה של מודל נגמרת, Claude Code ב-Positron עובר לבד למודל הבא, בלי שגיאות. הסדר: claude/claude-opus-5-5 ← agy/claude-opus-4-6-thinking ← agy/claude-sonnet-4-6 ← agy/gemini-3.1-pro-high (combo בשם `my-pro-fallback`).
2. בכל רגע רואים בשורת הסטטוס של Positron איזה מודל עונה.
3. רואים כמה מכסה נשארה.

השתמש במנגנונים שכבר קיימים ב-OmniRoute. לא לשנות את קוד המקור שלו.

## חומרים מוכנים
- להוריד את הכלים:
  `git clone -b claude/laughing-fermat-ymuc40 https://github.com/docomer/claude.git ~/omniroute-toolkit`
  (התיקייה `~/omniroute-toolkit/omniroute-positron/`)
- לקרוא קודם את `README.md`. יש שם את הממצאים ואת סדר הביצוע.
- הסקריפטים נבדקו רק מול מסד נתונים **מדומה**. לפני כל הרצה, לקרוא את הסקריפט ולוודא שההנחות שלו מתאימות למחשב הזה:
  - הסכמה של `call_logs`, `combos`, `provider_connections` ו-`key_value` (namespace `providerLimitsCache`) ב-`~/.omniroute/storage.sqlite`
  - גרסת OmniRoute המותקנת
  - שם ה-LaunchAgent (הסקריפט מניח `com.omeredgar.omniroute`)
  - הנתיבים `~/.positron/extensions` ו-`~/Library/Application Support/Positron/User/settings.json`
- אם משהו לא תואם, לתקן את הסקריפט ולא לעקוף אותו.

## מה כבר ידוע מקוד המקור של OmniRoute (אין צורך לחקור מחדש)
- **שורש הכשל:** `filterTargetsByRequestCompatibility` (`open-sse/services/combo/comboStructure.ts`) פוסל בצורה "קשה" כל מודל שה-`max_tokens` המבוקש גבוה מתקרת הפלט שלו. מודלי Antigravity מוגבלים ל-65,536, ו-Claude Code ביקש 128,000. לכן ב-combo מסוג priority נשאר רק Opus 5.5, והתוצאה הייתה 503. מנגנון הגיבוי שמנסה מודלים פסולים (#6238) קיים רק ב-round-robin.
- **התיקון:** `CLAUDE_CODE_MAX_OUTPUT_TOKENS=32000` בתוך `env` של `~/.claude/settings.json`.
- **גודל השיחה לא היה הבעיה.** לכל מודלי הגיבוי יש context של 1,048,576. שלב 1ג (`contextFilterMode`) לא נחוץ. לבדוק אותו רק אם הניסוי נכשל בגלל context.
- `gemini-3.1-pro-high` נשלח בפועל כ-`gemini-pro-agent`.
- Opus 4.6 ו-Sonnet 4.6 חולקים את חלון המכסה `claude_gpt_weekly`.
- **מי ענה:** הכותרות `X-OmniRoute-Model`, `X-OmniRoute-Provider` ו-`X-OmniRoute-Fallback-Attempts`, והטבלה `call_logs`.
- **מכסות:** `providerLimitsCache` בטבלה `key_value`, או `GET /api/usage/provider-limits`. לרענון: `POST`.
- **חסימת הפורט לרשת:** המשתנה `OMNIROUTE_SERVER_HOST=127.0.0.1` (`bin/cli/utils/serverHost.mjs`). צריך לוודא שהשרת באמת טוען את `~/.omniroute/.env` דרך ה-LaunchAgent. אם לא, להגדיר את המשתנה ב-`EnvironmentVariables` של ה-plist.

## סדר ביצוע
דחוף, כי נשארו רק 3% ממכסת Claude.

1. **0א:** `scripts/00-backup.sh`. לוודא שבתיקייה יש 7 קבצים.
2. **1א:** `scripts/01-fix-fallback.sh`.
3. **1ב:** להוסיף את `agy/claude-sonnet-4-6` כשלב 3 ב-`my-pro-fallback`. אפשר דרך ה-API של OmniRoute אם יש גישה מאומתת, או לבקש ממני לעשות את זה בלוח הבקרה. **לא לכתוב ישירות ל-SQLite בזמן שהשרת רץ.**
4. `scripts/02-verify.sh --no-live`, ולתקן כל בדיקה שנכשלה.
5. **2, ניסוי מבוקר:** לבקש ממני להעביר את Claude ל-Inactive בלוח הבקרה, ואז:
   - להריץ `scripts/02-verify.sh --regression` ולוודא:
     - בבקשה עם 32000 מתקבל HTTP 200 ו-`X-OmniRoute-Model` של Opus 4.6
     - בבקשה עם 128000 מתקבל כשל, כלומר הבאג המקורי, וזה מוכיח שהתיקון הוא שעשה את ההבדל
   - לבדוק גם שיחה ארוכה (יותר מ-200 אלף טוקנים), למשל בקשת curl עם תוכן מנופח, ולוודא שאין 503.
   - לבדוק מעבר הלאה ל-Sonnet ואחר כך ל-Gemini.
   - **בסוף להזכיר לי להחזיר את Claude ל-Active, ולוודא שהבקשה הבאה חוזרת ל-step 1.**
6. **0ב:** `scripts/04-cleanup.sh`. קודם dry-run ולהראות לי את התוצאה. לפני `--apply`, לבדוק אם Claude Desktop משתמש בפורט 9100 (`lsof` / `ps`). אם כן, להריץ עם `KEEP_DESKTOP_PROXY=1`.
7. **3:** `scripts/03-harden.sh`. לוודא שהשרת מאזין על `127.0.0.1:20128`, ושגם Claude Code וגם OmniCopilot עדיין עובדים. את חומת האש אני אדליק בעצמי.
8. **4:** `scripts/05-install-extension.sh`, ואז Reload Window. לוודא שיש רק סמל OmniRoute אחד בשורת הסטטוס ושהוא מציג את המודל ואת המכסה.
9. `scripts/02-verify.sh` מלא. כל הבדיקות צריכות לעבור.

## כללים
- לפני כל שינוי חייב להיות גיבוי. לא למחוק, רק להעביר לתיקיית הגיבוי.
- לעצור ולשאול אותי לפני: שינוי בלוח הבקרה, `--apply` של הניקוי, כיבוי LaunchAgent, והפעלה מחדש של OmniRoute.
- אם בדיקה נכשלת, לחקור את הסיבה (`call_logs`, `error_summary`, לוגים של OmniRoute) ולתקן. לא להמשיך הלאה.
- בסוף לתת לי טבלה בעברית: כל שלב, מה בוצע, תוצאת הבדיקה, ומה נשאר לי לעשות ידנית.
