import nh3

# Only the tags/attributes our editor can actually produce. Anything else
# (e.g. <script>, onclick=...) is stripped before it reaches the database.
ALLOWED_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre",
}


def sanitize_html(html: str) -> str:
    return nh3.clean(html, tags=ALLOWED_TAGS, attributes={})
