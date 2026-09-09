"""Fail-closed historical verification for the reviewed grid/path Javadoc edits."""

import hashlib
import json
import base64
from pathlib import Path


REVIEW = "evidence/documentation/java-grid-path-comments-review.json"
SNAPSHOT = "evidence/documentation/java-grid-path-comment-snapshots.json"
BASELINE = "40fb809aea694eda3cab31bf9fd1b829eeb6a27f"
PATHS = frozenset((
    "packages/java/src/main/java/org/procedurals/layout/RegularGrid.java",
    "packages/java/src/main/java/org/procedurals/paths/GradientPath2D.java",
))
OPERATORS = tuple(sorted((
    ">>>=", ">>=", "<<=", "...", "::", "->", "++", "--", "==", "!=", "<=", ">=",
    "&&", "||", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>>", ">>",
), key=len, reverse=True))


def _sha(data):
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def _java_tokens(source):
    """Return Java lexical tokens excluding comments, or None for malformed source.

    Strings and character literals remain single tokens. Punctuation remains separate tokens,
    so source token boundaries such as ``+ +`` cannot be confused with ``++``.
    """
    tokens = []
    index = 0
    length = len(source)
    # Java translates Unicode escapes before recognizing comments and literals. Supporting only
    # post-translation source would therefore create a false comment-only assurance.
    if "\\u" in source:
        return None
    while index < length:
        character = source[index]
        if character.isspace():
            index += 1
        elif character == "/" and index + 1 < length and source[index + 1] == "/":
            index = source.find("\n", index + 2)
            if index < 0:
                index = length
        elif character == "/" and index + 1 < length and source[index + 1] == "*":
            end = source.find("*/", index + 2)
            if end < 0:
                return None
            index = end + 2
        elif character in ('"', "'"):
            quote = character
            start = index
            index += 1
            while index < length:
                if source[index] in "\r\n":
                    return None
                if source[index] == "\\":
                    index += 2
                    if index > length:
                        return None
                elif source[index] == quote:
                    index += 1
                    tokens.append(source[start:index])
                    break
                else:
                    index += 1
            else:
                return None
        elif character.isalpha() or character in "_$":
            start = index
            index += 1
            while index < length and (source[index].isalnum() or source[index] in "_$"):
                index += 1
            tokens.append(source[start:index])
        elif character.isdigit():
            start = index
            index += 1
            while index < length and (source[index].isalnum() or source[index] in "._"):
                index += 1
            tokens.append(source[start:index])
        else:
            operator = next((value for value in OPERATORS if source.startswith(value, index)), None)
            tokens.append(operator if operator is not None else character)
            index += len(operator) if operator is not None else 1
    return tokens


def _load_object(root, relative):
    try:
        return json.loads((root / relative).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def _valid_sha(value):
    return isinstance(value, str) and len(value) == 64 and all(character in "0123456789abcdef" for character in value)


def _review_files(review):
    if not isinstance(review.get("files"), list):
        return None
    entries = {}
    for entry in review["files"]:
        if not isinstance(entry, dict) or entry.get("source") not in PATHS:
            return None
        source = entry["source"]
        if source in entries:
            return None
        if not all(_valid_sha(entry.get(key)) for key in ("old_sha256", "new_sha256")):
            return None
        if entry.get("noncomment_tokens_identical") is not True:
            return None
        entries[source] = entry
    return entries if set(entries) == PATHS else None


def matches_reviewed_java_comments(root, relative, historical_sha256):
    """Return whether one exact reviewed Java source still differs only by comments.

    ``root`` must contain the immutable snapshot and reviewed-documentation record. The caller
    supplies the expected historical source hash. This intentionally has no Git dependency:
    it validates snapshot text, the review binding, current bytes, and lexed noncomment tokens.
    Any malformed, stale, incomplete, or broader record fails closed.
    """
    root = Path(root)
    if relative not in PATHS or not _valid_sha(historical_sha256):
        return False
    snapshot = _load_object(root, SNAPSHOT)
    review = _load_object(root, REVIEW)
    if not isinstance(snapshot, dict) or not isinstance(review, dict):
        return False
    if snapshot.get("baseline_commit") != BASELINE or snapshot.get("review_path") != REVIEW:
        return False
    try:
        review_bytes = (root / REVIEW).read_bytes()
    except OSError:
        return False
    if snapshot.get("review_sha256") != _sha_bytes(review_bytes):
        return False
    if review.get("status") != "reviewed-documentation-only" or review.get("owner") != "root" or review.get("reviewer") != "root":
        return False
    if review.get("baseline_commit") != BASELINE:
        return False
    review_files = _review_files(review)
    sources = snapshot.get("sources")
    if review_files is None or not isinstance(sources, dict) or set(sources) != PATHS:
        return False
    entry = sources.get(relative)
    if not isinstance(entry, dict) or set(entry) != {"historical_sha256", "current_sha256", "historical_source_utf8_base64"}:
        return False
    try:
        old = base64.b64decode(entry["historical_source_utf8_base64"], validate=True).decode("utf-8")
    except (KeyError, TypeError, ValueError, UnicodeDecodeError):
        return False
    if entry["historical_sha256"] != historical_sha256 or _sha(old) != historical_sha256:
        return False
    review_entry = review_files[relative]
    if review_entry["old_sha256"] != historical_sha256 or review_entry["new_sha256"] != entry["current_sha256"]:
        return False
    try:
        current_bytes = (root / relative).read_bytes()
        current = current_bytes.decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return False
    if _sha_bytes(current_bytes) != entry["current_sha256"]:
        return False
    historical_tokens = _java_tokens(old)
    current_tokens = _java_tokens(current)
    return historical_tokens is not None and historical_tokens == current_tokens
