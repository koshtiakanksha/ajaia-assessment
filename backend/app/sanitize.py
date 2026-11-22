import re

import nh3

# Only the tags/attributes our editor (TipTap) can actually produce. Anything
# else (e.g. <script>, onclick=..., javascript: URLs) is stripped before it
# reaches the database.
ALLOWED_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre",
    "hr", "a", "span", "mark", "label", "input", "div",
}

# Text formatting (fonts, sizes, colors, alignment, line spacing) is stored as
# inline styles. Only these CSS properties survive...
ALLOWED_STYLE_PROPERTIES = {
    "font-family", "font-size", "color", "background-color", "text-align", "line-height",
}
_STYLED = {"p", "h1", "h2", "h3", "span", "mark", "li"}

ALLOWED_ATTRIBUTES = {
    "a": {"href"},
    **{tag: {"style"} for tag in _STYLED},
    "mark": {"style", "data-color"},
    # Checklists: <ul data-type="taskList"><li data-type="taskItem" data-checked="true">
    "ul": {"data-type"},
    "li": {"style", "data-type", "data-checked"},
    "input": {"type", "checked"},
}
ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}

# ...and only with plain values: no url(), expression(), escapes or markup.
_SAFE_STYLE_VALUE = re.compile(r"^[#\w\s.,%'\"()+-]{1,100}$")
_FORBIDDEN_IN_STYLE = ("url(", "expression(", "javascript:", "\\", "@import")


def _clean_style(style: str) -> str | None:
    kept = []
    for declaration in style.split(";"):
        if ":" not in declaration:
            continue
        prop, value = (part.strip() for part in declaration.split(":", 1))
        lowered = value.lower()
        if (
            prop.lower() in ALLOWED_STYLE_PROPERTIES
            and _SAFE_STYLE_VALUE.match(value)
            and not any(bad in lowered for bad in _FORBIDDEN_IN_STYLE)
        ):
            kept.append(f"{prop.lower()}: {value}")
    return "; ".join(kept) or None


def _attribute_filter(tag: str, attr: str, value: str) -> str | None:
    if attr == "style":
        return _clean_style(value)
    if attr == "data-type":
        return value if value in ("taskList", "taskItem") else None
    if attr == "data-checked":
        return value if value in ("true", "false") else None
    if tag == "input" and attr == "type":
        return value if value == "checkbox" else None
    if attr == "data-color":
        return value if _SAFE_STYLE_VALUE.match(value) and "(" not in value else None
    return value


_STYLE_ATTR = re.compile(r'style="([^"]*)"')


def sanitize_html(html: str) -> str:
    # nh3 also adds rel="noopener noreferrer" to links.
    cleaned = nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=ALLOWED_URL_SCHEMES,
        filter_style_properties=ALLOWED_STYLE_PROPERTIES,
        attribute_filter=_attribute_filter,
    )
    # nh3 re-serializes "Georgia, serif" as "Georgia , serif"; tidy it so the
    # editor's font picker recognizes the value.
    return _STYLE_ATTR.sub(lambda m: 'style="' + re.sub(r"\s+,", ",", m.group(1)) + '"', cleaned)
