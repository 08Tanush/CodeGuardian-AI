"""
pdf_generator.py
Turns an analysis dict (the SAME dict produced by analyzer.analyze_repository
and already used by report_generator.py for the Markdown report) into a
professional, paginated PDF report. No analysis is re-run here - this is
purely a rendering step over data that's already been computed.

Two rules every string follows before it reaches reportlab:
  1. It is XML-escaped. Paragraph() parses its input as markup, so a raw
     "<script>" or "&" from AI prose or a file path would either vanish,
     render wrong, or crash the build.
  2. It is folded into the WinAnsi range the built-in Helvetica/Courier
     fonts can draw. AI prose regularly contains typographic characters
     (non-breaking hyphens, narrow no-break spaces, arrows) that those
     fonts render as black boxes.
"""

from datetime import datetime, timezone
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

INK = colors.HexColor("#16181d")
MUTED = colors.HexColor("#6b7079")
RULE = colors.HexColor("#e3e5e8")
ACCENT = colors.HexColor("#1f9d6b")

_SEVERITY_COLORS = {
    "high": colors.HexColor("#c8312b"),
    "medium": colors.HexColor("#b26a00"),
    "low": MUTED,
}
_SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}

# Typographic characters that commonly show up in AI prose, mapped to
# something Helvetica can actually draw.
_CHAR_MAP = str.maketrans({
    "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-",
    "−": "-", " ": " ", " ": " ", " ": " ", " ": " ", " ": " ",
    "​": "", "⁠": "", "﻿": "",
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "…": "...", "•": "-", "→": "->", "←": "<-", "⇒": "=>",
    "≤": "<=", "≥": ">=", "≠": "!=", "✓": "v", "✔": "v",
})


def _clean(text) -> str:
    """Fold to WinAnsi-drawable text; anything still undrawable becomes '?'."""
    s = str(text if text is not None else "").translate(_CHAR_MAP)
    return s.encode("cp1252", errors="replace").decode("cp1252")


def _p(text, style) -> Paragraph:
    """Paragraph from untrusted plain text: cleaned and escaped."""
    return Paragraph(escape(_clean(text)), style)


class _NumberedCanvas(pdfcanvas.Canvas):
    """
    Standard reportlab two-pass recipe for "Page X of Y" footers - the
    total page count isn't known until every page has already been laid
    out, so each page's state is buffered and only actually drawn (with
    the now-known total) during save().
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(total_pages)
            super().showPage()
        super().save()

    def _draw_footer(self, total_pages: int):
        self.setStrokeColor(RULE)
        self.setLineWidth(0.5)
        self.line(20 * mm, 16 * mm, A4[0] - 20 * mm, 16 * mm)
        self.setFont("Helvetica", 8)
        self.setFillColor(MUTED)
        self.drawString(20 * mm, 11 * mm, "CodeGuardian AI - Engineering Report")
        self.drawRightString(A4[0] - 20 * mm, 11 * mm, f"Page {self._pageNumber} of {total_pages}")


def _score_color(score: int):
    if score >= 80:
        return ACCENT
    if score >= 55:
        return _SEVERITY_COLORS["medium"]
    return _SEVERITY_COLORS["high"]


def _styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle("ReportTitle", parent=s["Title"], fontSize=20, leading=24,
                         alignment=0, spaceAfter=2, textColor=INK))
    s.add(ParagraphStyle("ReportMeta", parent=s["Normal"], fontSize=8.5, leading=12, textColor=MUTED))
    s.add(ParagraphStyle("SectionHeading", parent=s["Heading2"], fontSize=12.5, leading=16,
                         spaceBefore=16, spaceAfter=6, textColor=INK))
    s.add(ParagraphStyle("Body", parent=s["Normal"], fontSize=9.5, leading=14, textColor=INK))
    s.add(ParagraphStyle("Cell", parent=s["Normal"], fontSize=8.5, leading=11.5, textColor=INK))
    s.add(ParagraphStyle("PathCell", parent=s["Normal"], fontName="Courier", fontSize=7.5,
                         leading=10, textColor=MUTED, splitLongWords=True))
    s.add(ParagraphStyle("ReportBullet", parent=s["Normal"], fontSize=9.5, leading=14,
                         leftIndent=12, bulletIndent=0, spaceAfter=2, textColor=INK))
    # Explicit leading matters here: without it a 30pt number sits on a
    # 12pt line box and draws over whatever comes next.
    s.add(ParagraphStyle("ScoreNumber", parent=s["Normal"], fontName="Helvetica-Bold",
                         fontSize=30, leading=34))
    return s


def _bullets(items: list[str], style) -> list:
    if not items:
        return [_p("None identified.", style)]
    return [Paragraph(escape(_clean(item)), style, bulletText="-") for item in items]


def _findings_table(issues: list[dict], styles) -> Table | None:
    """
    One row per finding: severity | category | description with the file
    path underneath at full width. Putting the path under the description
    (rather than in a narrow column of its own) is what keeps deep paths
    from wrapping one character per line and blowing a short list of
    findings up into a dozen pages.
    """
    if not issues:
        return None
    ordered = sorted(issues, key=lambda i: (_SEVERITY_ORDER.get(i.get("severity"), 3), i.get("category", "")))
    rows = [["Severity", "Category", "Finding"]]
    commands = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]
    for row_idx, issue in enumerate(ordered, start=1):
        severity = issue.get("severity", "low")
        rows.append([
            _clean(severity).upper(),
            _clean(issue.get("category", "")).title(),
            [_p(issue.get("description", ""), styles["Cell"]),
             _p(issue.get("file") or "/", styles["PathCell"])],
        ])
        commands.append(("TEXTCOLOR", (0, row_idx), (0, row_idx), _SEVERITY_COLORS.get(severity, MUTED)))
        commands.append(("FONTNAME", (0, row_idx), (0, row_idx), "Helvetica-Bold"))

    table = Table(rows, colWidths=[52, 78, 340], repeatRows=1)
    table.setStyle(TableStyle(commands))
    return table


def build_pdf_report(analysis: dict) -> bytes:
    """Renders the analysis dict into a professional, paginated PDF and returns the raw bytes."""
    repo = analysis["repository"]
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    styles = _styles()
    score = analysis["maintainability_score"]
    mode = "AI-assisted" if analysis.get("analysis_mode") == "ai" else "Static analysis"

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=22 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
        title=_clean(f"CodeGuardian AI Report - {repo['name']}"),
    )

    story = [
        _p("Engineering Report", styles["ReportTitle"]),
        _p(f"{repo['name']}  |  Generated {generated_at}  |  {mode}", styles["ReportMeta"]),
        Spacer(1, 12),
    ]

    score_block = Table(
        [[Paragraph(f"<font color='{_score_color(score).hexval().replace('0x', '#')}'>{score}</font>"
                    f"<font size=11 color='#6b7079'> / 100</font>", styles["ScoreNumber"]),
          _p("Maintainability score. Computed from the number and severity of static analysis findings.",
             styles["ReportMeta"])]],
        colWidths=[110, 360],
    )
    score_block.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("LINEABOVE", (0, 0), (-1, 0), 0.8, INK),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(score_block)

    story.append(_p("Repository Summary", styles["SectionHeading"]))
    story.append(_p(analysis["summary"], styles["Body"]))
    story.append(Spacer(1, 8))

    stats_table = Table([
        [_clean(label), _p(value, styles["Cell"])] for label, value in [
            ("Files analyzed", repo["file_count"]),
            ("Lines of code", repo["total_lines"]),
            ("Repository size", repo["total_size_display"]),
            ("Primary language", repo["primary_language"]),
            ("Framework(s) detected", repo["framework"]),
        ]
    ], colWidths=[150, 320])
    stats_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
    ]))
    story.append(stats_table)

    for heading, key in [
        ("Architecture Overview", "architecture_overview"),
        ("Code Quality", "code_quality"),
        ("Security Analysis", "security_analysis"),
        ("Documentation Analysis", "documentation_analysis"),
    ]:
        story.append(_p(heading, styles["SectionHeading"]))
        story.append(_p(analysis[key], styles["Body"]))

    story.append(_p(f"Detailed Findings ({len(analysis['issues'])})", styles["SectionHeading"]))
    findings_table = _findings_table(analysis["issues"], styles)
    story.append(findings_table or _p("No issues were found.", styles["Body"]))

    for heading, key in [
        ("Strengths", "strengths"),
        ("Suggestions", "ai_suggestions"),
        ("Improvement Roadmap", "improvement_roadmap"),
    ]:
        story.append(_p(heading, styles["SectionHeading"]))
        story.extend(_bullets(analysis[key], styles["ReportBullet"]))

    doc.build(story, canvasmaker=_NumberedCanvas)
    return buffer.getvalue()


if __name__ == "__main__":
    # Self-check: hostile strings must not crash the build or leak markup.
    sample = {
        "repository": {"name": "r&d <x>", "file_count": 1, "total_lines": 2, "total_size_display": "1 KB",
                       "primary_language": "Python", "framework": "None"},
        "maintainability_score": 42, "analysis_mode": "ai",
        "summary": "medium‑level & <script>alert(1)</script> → done !",
        "architecture_overview": "a", "code_quality": "b", "security_analysis": "c", "documentation_analysis": "d",
        "issues": [{"category": "security", "severity": "high", "file": "a/" * 60 + "x.py",
                    "description": "x < y & z"}] * 40,
        "strengths": ["<b>ok</b>"], "ai_suggestions": [], "improvement_roadmap": ["✓ ship"],
    }
    out = build_pdf_report(sample)
    assert out.startswith(b"%PDF"), "not a PDF"
    print("pdf self-check ok:", len(out), "bytes")
