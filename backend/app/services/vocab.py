"""Turns a transcript into an answer: yes/no, a number, or one of the listed choices.

Works for English (en), Hindi (hi) and Odia (or). Returns None when nothing matches,
and the app then asks the person to tap.
"""
import re
from difflib import SequenceMatcher

YES = {
    "en": ["yes", "yeah", "yep", "yup", "correct", "right"],
    "hi": ["हाँ", "हां", "जी हाँ", "जी हां", "हा", "जी"],
    "or": ["ହଁ", "ହଁ ଅଛି", "ହଁ ଅଛି", "ଅଛି"],
}
NO = {
    "en": ["no", "nope", "nah", "not"],
    "hi": ["नहीं", "ना", "नही", "नहि"],
    "or": ["ନାହିଁ", "ନା", "ନାହିଁ"],
}

# Digits in three scripts: Latin, Devanagari, Odia.
_DIGIT_MAP = {**{c: str(i) for i, c in enumerate("0123456789")},
              **{c: str(i) for i, c in enumerate("०१२३४५६७८९")},
              **{c: str(i) for i, c in enumerate("୦୧୨୩୪୫୬୭୮୯")}}

_EN_UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
             "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
_EN_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}

_HI_WORDS = (
    "शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस "
    "इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस "
    "इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास "
    "इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ "
    "इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर "
    "इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उनासी अस्सी "
    "इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे "
    "इक्यानवे बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे"
).split()
assert len(_HI_WORDS) == 100, len(_HI_WORDS)
HI_NUMBERS = {w: i for i, w in enumerate(_HI_WORDS)}
# Common spelling variants.
HI_NUMBERS.update({"पांच": 5, "छः": 6, "छे": 6, "पन्द्रह": 15, "तैतीस": 33, "चौंतीस": 34, "पैंतीस": 35, "अट्ठाईस": 28})


def normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[.,!?;:।\"'()\[\]-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _has_phrase(text: str, phrase: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text) is not None


def match_yesno(text: str, lang: str) -> str | None:
    t = normalize(text)
    if not t:
        return None
    # Check "no" first: "no" should win over a stray "yes" in "yes ... no" corrections at the end.
    no = any(_has_phrase(t, w) for w in NO.get(lang, []) + (NO["en"] if lang != "en" else []))
    yes = any(_has_phrase(t, w) for w in YES.get(lang, []) + (YES["en"] if lang != "en" else []))
    if no and not yes:
        return "no"
    if yes and not no:
        return "yes"
    if yes and no:
        # Both words: the last one said is the correction.
        last_no = max((t.rfind(w) for w in NO.get(lang, []) + NO["en"]), default=-1)
        last_yes = max((t.rfind(w) for w in YES.get(lang, []) + YES["en"]), default=-1)
        return "no" if last_no > last_yes else "yes"
    return None


def _en_number(tokens: list[str]) -> int | None:
    total, found = 0, False
    for tok in tokens:
        if tok in _EN_UNITS:
            total += _EN_UNITS.index(tok)
            found = True
        elif tok in _EN_TENS:
            total += _EN_TENS[tok]
            found = True
        elif "-" in tok:
            return None
    return total if found else None


def match_number(text: str, lang: str) -> int | None:
    # 1. Digits in any script (Whisper often writes numbers as digits).
    mapped = "".join(_DIGIT_MAP.get(c, c) for c in text)
    m = re.search(r"\d{1,3}", mapped)
    if m:
        return int(m.group())
    # 2. Number words.
    raw = text.lower().replace("-", " ")
    t = normalize(raw)
    tokens = t.split()
    if lang == "hi" or any(tok in HI_NUMBERS for tok in tokens):
        for tok in tokens:
            if tok in HI_NUMBERS:
                return HI_NUMBERS[tok]
    return _en_number(tokens)


def match_choice(text: str, choices: list[dict], threshold: float = 0.6) -> str | None:
    """choices is a list of {"value": ..., "label": ...} in the interview language."""
    t = normalize(text)
    if not t or not choices:
        return None
    best_value, best_score = None, 0.0
    for c in choices:
        label = normalize(str(c["label"]))
        score = SequenceMatcher(None, t, label).ratio()
        # A label said inside a longer sentence also counts.
        if label and _has_phrase(t, label):
            score = max(score, 0.95)
        # Individual words, e.g. "sometimes" in "yes sometimes".
        for word in t.split():
            for lw in label.split():
                if len(lw) > 2:
                    score = max(score, SequenceMatcher(None, word, lw).ratio() * 0.9)
        if score > best_score:
            best_value, best_score = c["value"], score
    return best_value if best_score >= threshold else None


def confidence_for(matched) -> float:
    return 0.0 if matched is None else 1.0
