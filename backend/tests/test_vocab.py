import pytest

from app.services.vocab import match_choice, match_number, match_yesno

YESNO = [
    # English
    ("yes", "en", "yes"), ("Yeah.", "en", "yes"), ("no", "en", "no"), ("Nope", "en", "no"),
    ("yes I do", "en", "yes"), ("no I do not", "en", "no"), ("banana", "en", None), ("yes no", "en", "no"),
    ("know", "en", None), ("", "en", None), ("yes yes", "en", "yes"),
    # Hindi
    ("हाँ", "hi", "yes"), ("हां", "hi", "yes"), ("जी हाँ", "hi", "yes"), ("नहीं", "hi", "no"),
    ("ना", "hi", "no"), ("नही", "hi", "no"), ("जी हां बिल्कुल", "hi", "yes"), ("नहीं नहीं", "hi", "no"),
    ("पानी", "hi", None), ("yes", "hi", "yes"), ("हाँ हाँ", "hi", "yes"),
    # Odia
    ("ହଁ", "or", "yes"), ("ହଁ ଅଛି", "or", "yes"), ("ନାହିଁ", "or", "no"), ("ନା", "or", "no"),
    ("ନା ନା", "or", "no"), ("ହଁ ହଁ", "or", "yes"), ("କିଛି", "or", None), ("no", "or", "no"),
    ("ହଁ ମୋର ଅଛି", "or", "yes"), ("ନାହିଁ ମୋର", "or", "no"),
]


@pytest.mark.parametrize("text,lang,want", YESNO)
def test_yesno(text, lang, want):
    assert match_yesno(text, lang) == want


NUMBERS = [
    ("34", "en", 34), ("I am 45 years old", "en", 45), ("twenty five", "en", 25), ("thirty-two", "en", 32),
    ("seven", "en", 7), ("nineteen", "en", 19), ("ninety nine", "en", 99), ("hello", "en", None),
    ("३४", "hi", 34), ("बयालीस", "hi", 42), ("पचास", "hi", 50), ("मेरी उम्र पैंतीस है", "hi", 35),
    ("उन्नीस", "hi", 19), ("सत्तर", "hi", 70), ("99", "hi", 99), ("निन्यानवे", "hi", 99), ("पानी", "hi", None),
    ("୩୪", "or", 34), ("୫୦", "or", 50), ("28", "or", 28),
]


@pytest.mark.parametrize("text,lang,want", NUMBERS)
def test_number(text, lang, want):
    assert match_number(text, lang) == want


CHOICES = {
    "en": [{"value": "never", "label": "Never"}, {"value": "sometimes", "label": "Sometimes"}, {"value": "often", "label": "Often"}],
    "hi": [{"value": "never", "label": "कभी नहीं"}, {"value": "sometimes", "label": "कभी-कभी"}, {"value": "often", "label": "अक्सर"}],
    "or": [{"value": "never", "label": "କେବେ ନୁହେଁ"}, {"value": "sometimes", "label": "କେବେ କେବେ"}, {"value": "often", "label": "ପ୍ରାୟ"}],
}
CHOICE_CASES = [
    ("sometimes", "en", "sometimes"), ("Often.", "en", "often"), ("never", "en", "never"), ("i get them sometimes", "en", "sometimes"),
    ("somtimes", "en", "sometimes"), ("table", "en", None), ("अक्सर", "hi", "often"), ("कभी-कभी", "hi", "sometimes"),
    ("कभी नहीं", "hi", "never"), ("ପ୍ରାୟ", "or", "often"), ("କେବେ କେବେ", "or", "sometimes"), ("କେବେ ନୁହେଁ", "or", "never"),
]


@pytest.mark.parametrize("text,lang,want", CHOICE_CASES)
def test_choice(text, lang, want):
    assert match_choice(text, CHOICES[lang]) == want
