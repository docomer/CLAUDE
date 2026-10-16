# הקמת היריד — מדריך צעד אחר צעד

זמן משוער: 30–45 דקות. לא צריך ניסיון בתכנות. רק להעתיק ולהדביק.

## 1. Supabase (מסד נתונים והתחברות) — חינם

1. נרשמים ב-https://supabase.com ופותחים פרויקט חדש. **Region: Frankfurt (eu-central-1)** — הכי קרוב לישראל.
2. שומרים את סיסמת מסד הנתונים במקום בטוח.
3. **SQL Editor → New query** → מדביקים את כל התוכן של
   `supabase/migrations/20261016000000_init.sql` → **Run**. אמור להופיע "Success".
4. **Project Settings → API**: מעתיקים את `Project URL`, את `anon public` ואת `service_role` (סודי!).

### התחברות הורים — בוחרים אחת

**אפשרות א׳ — מייל (מהירה, חינם, מומלצת ליריד המשפחתי):**
1. **Authentication → Sign In / Providers → Email**: מוודאים ש-Email מופעל.
2. **Authentication → Emails → Templates → Magic Link**: מחליפים את גוף ההודעה כך שיכלול את הקוד:
   ```html
   <h2>קוד הכניסה שלך להיריד</h2>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   ```
3. ב-`.env`: `NEXT_PUBLIC_AUTH_METHOD=email`

**אפשרות ב׳ — SMS (כמו באפיון, עולה כסף לכל הודעה):**
1. פותחים חשבון אצל ספק SMS (למשל Twilio).
2. **Authentication → Sign In / Providers → Phone**: מפעילים ומזינים את פרטי הספק.
3. ב-`.env`: `NEXT_PUBLIC_AUTH_METHOD=phone`

## 2. Vercel (אחסון האתר) — חינם

1. נרשמים ב-https://vercel.com עם חשבון GitHub.
2. **Add New → Project** → בוחרים את הריפו → **Root Directory: `kids-market`**.
3. ב-**Environment Variables** מוסיפים את כל המשתנים מ-`.env.example`:

| משתנה | מאיפה |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → service_role |
| `NEXT_PUBLIC_AUTH_METHOD` | `email` או `phone` |
| `KID_AUTH_SECRET` | מחרוזת אקראית ארוכה (ראו למטה). **לא לשנות אחר כך!** |
| `NEXT_PUBLIC_SITE_URL` | הכתובת ש-Vercel נותן, למשל `https://hayarid.vercel.app` |

ליצירת `KID_AUTH_SECRET` אפשר להריץ במחשב: `openssl rand -hex 32`.

4. **Deploy**.

### התראות (רשות, אפשר להוסיף אחר כך)
- **Push**: מריצים `npx web-push generate-vapid-keys` ומזינים את `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ו-`VAPID_PRIVATE_KEY`.
- **מייל**: נרשמים ל-https://resend.com, מזינים `RESEND_API_KEY` ו-`EMAIL_FROM`.

אחרי שינוי משתנים — **Redeploy**.

## 3. ההזמנה הראשונה (רק פעם אחת)

ההרשמה בהזמנה בלבד, אז את ההזמנה הראשונה יוצרים ידנית.
ב-Supabase → **SQL Editor**:

```sql
insert into public.invites (max_uses) values (1) returning code;
```

מקבלים קוד, למשל `K7M2QX9A`. נכנסים ל-`https://<האתר>/join/K7M2QX9A` ונרשמים.

אחרי ההרשמה, הופכים את עצמכם למנהלי מערכת:

```sql
-- מחליפים במייל (או בטלפון בפורמט 9725XXXXXXXX) שאיתו נרשמתם
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com' or phone = '972500000000');
```

## 4. היריד המשפחתי 🎪

1. **משפחה ← הוספת ילד/ה**: כינוי, שם מלא, אווטאר וקוד סודי בן 4 ספרות.
2. **ירידים ← פתיחת יריד חדש** → "יריד המשפחה", שבוע אחד.
3. בעמוד הניהול של היריד: **העתקה / שיתוף** של הקישור → שולחים בוואטסאפ לבני המשפחה.
4. הילדים נכנסים ב-**"אני ילד/ה"** עם **הקוד המשפחתי** (מופיע בעמוד "משפחה") והקוד הסודי שלהם.
5. בטלפון: פותחים את האתר ← שיתוף ← **"הוספה למסך הבית"**. עכשיו זו אפליקציה 📱

## מה לבדוק ביריד המשפחתי

- [ ] ילד מעלה מודעה ← ההורה מקבל התראה ומאשר
- [ ] ילד ממשפחה אחרת שולח הודעה ← מספר טלפון מוסתר אוטומטית
- [ ] הצעת מחיר ← הצעה נגדית ← הסכמה
- [ ] הורה הקונה מאשר ← ההורים מתאמים מסירה בצ'אט
- [ ] שני הצדדים לוחצים "נמסר" ← מדבקת תודה ← מסך "העסק שלי" מתעדכן
- [ ] דיווח וחסימה עובדים
- [ ] מנהלת המוצר עוברת על כל מסך ורושמת מה לשנות (הטקסטים ב-`src/lib/content.ts`)

## לפיתוח מקומי

```bash
cd kids-market
cp .env.example .env.local   # ממלאים ערכים
npm install
npm run dev                  # http://localhost:3000
```

בדיקות מסד הנתונים (צריך Postgres 16 מקומי):

```bash
PGHOST=/tmp/kidsmarket-pg PGPORT=54329 supabase/tests/run.sh
```
