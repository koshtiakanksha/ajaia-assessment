import re

import pytest

from app.sanitize import sanitize_html


def compact(html: str) -> str:
    """nh3 re-serializes styles compactly: 'color: red; x: y' -> 'color:red;x:y'."""
    return re.sub(r'style="([^"]*)"', lambda m: 'style="' + re.sub(r"\s*([:;])\s*", r"\1", m.group(1)) + '"', html)


@pytest.mark.parametrize(
    "html",
    [
        '<p style="text-align: center">centered</p>',
        '<h2 style="text-align: right">right heading</h2>',
        '<p><span style="font-family: Georgia, serif">serif</span></p>',
        '<p><span style="font-size: 18px">big</span></p>',
        '<p><span style="color: #c0392b">red</span></p>',
        '<p><span style="color: rgb(0, 29, 107)">navy</span></p>',
        '<p><mark data-color="#fff59d" style="background-color: #fff59d; color: inherit">hi</mark></p>',
        '<p style="line-height: 1.5">spaced</p>',
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">'
        '<label><input type="checkbox" checked=""><span></span></label><div><p>done</p></div></li></ul>',
    ],
)
def test_editor_formatting_survives(html):
    assert sanitize_html(html) == compact(html)


@pytest.mark.parametrize(
    "dirty, expected",
    [
        ('<p style="position: fixed; color: red">x</p>', '<p style="color: red">x</p>'),
        ('<span style="background-image: url(javascript:alert(1))">x</span>', "<span>x</span>"),
        ('<span style="color: expression(alert(1))">x</span>', "<span>x</span>"),
        ('<span style="font-family: \\61 lert">x</span>', "<span>x</span>"),
        ('<span style="color: red; behavior: url(x.htc)">x</span>', '<span style="color: red">x</span>'),
        ('<p style="color: <script>">x</p>', "<p>x</p>"),
        ('<li data-type="evil" data-checked="maybe">x</li>', "<li>x</li>"),
        ('<input type="text" onfocus="alert(1)">', "<input>"),
        ('<div style="color: red" onclick="x()">x</div>', "<div>x</div>"),
    ],
)
def test_unsafe_styles_and_attributes_are_stripped(dirty, expected):
    assert sanitize_html(dirty) == compact(expected)
