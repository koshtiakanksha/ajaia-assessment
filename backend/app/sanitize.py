import nh3

# Only the tags/attributes our editor (TipTap StarterKit) can actually produce.
# Anything else (e.g. <script>, onclick=..., javascript: URLs) is stripped
# before it reaches the database.
ALLOWED_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre",
    "hr", "a",
}
ALLOWED_ATTRIBUTES = {"a": {"href"}}
ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}


def sanitize_html(html: str) -> str:
    # nh3 also adds rel="noopener noreferrer" to links.
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=ALLOWED_URL_SCHEMES,
    )
