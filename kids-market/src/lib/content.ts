// כל הטקסטים שמנהלת המוצר הצעירה יכולה לשנות — במקום אחד.

export const APP_NAME = "היריד";
export const APP_TAGLINE = "יריד הצעצועים של הילדים";
export const MAX_PRICE = 100;
export const MAX_PHOTOS = 4;

export const AVATARS: Record<string, string> = {
  fox: "🦊", lion: "🦁", owl: "🦉", cat: "🐱", dog: "🐶", panda: "🐼",
  unicorn: "🦄", frog: "🐸", tiger: "🐯", penguin: "🐧", octopus: "🐙", dragon: "🐲",
  koala: "🐨", rabbit: "🐰", bear: "🐻", monkey: "🐵",
};

export const CATEGORIES: Record<string, string> = {
  toys: "צעצועים", books: "ספרים", games: "משחקים", lego: "לגו והרכבות",
  dolls: "בובות", sports: "ספורט", crafts: "יצירה", other: "אחר",
};

export const CONDITIONS: Record<string, string> = {
  new: "חדש", like_new: "כמו חדש", used: "משומש",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין לאישור הורה", active: "במכירה", rejected: "לא אושר",
  reserved: "שמור לקונה", sold: "נמכר", withdrawn: "הורד", removed: "הוסר",
};

export const DEAL_STATUS_LABELS: Record<string, string> = {
  awaiting_parent: "מחכה לאישור הורה הקונה", approved: "אושר — מתאמים מסירה",
  declined: "לא אושר", completed: "הושלם ✅", cancelled: "בוטל",
};

export const STICKERS: Record<string, string> = {
  trusted: "🤝 מוכר/ת אמין/ה", polite: "😊 מנומס/ת", fast: "⚡ מהיר/ה",
  great_item: "🌟 פריט מעולה", fair_price: "💰 מחיר הוגן", friendly: "💛 חברותי/ת",
};

export const BUYER_TEMPLATES = [
  "היי! זה עדיין זמין?",
  "וואו, נראה ממש מגניב! 😍",
  "הכל עובד בו?",
  "יש עוד חלקים שמגיעים איתו?",
  "תודה רבה!",
];

export const SELLER_TEMPLATES = [
  "היי! כן, זה עדיין זמין 😊",
  "הכל עובד מעולה!",
  "אפשר לשאול את ההורים שלי מתי נוח למסור",
  "תודה רבה!",
];

export const FORBIDDEN_ITEMS = [
  "אוכל וממתקים",
  "בעלי חיים",
  "תרופות",
  "נשק או חיקויי נשק",
  "טלפונים וטאבלטים",
];

export const APPROVAL_CHECKLIST = [
  "הפריט שייך לילד ומותר לו למכור אותו",
  "הפריט לא ברשימת הפריטים האסורים",
  "אין פנים, שמות או כתובות בתמונות",
  "המחיר סביר",
];
