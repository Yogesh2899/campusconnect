"""Build the directory PDF from the repository's DCSE seed records."""
import re
import sqlite3
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets' / 'thapar-connect-directory.pdf'
SQL = ROOT / 'prisma/migrations/202611190002_dcse_directory/migration.sql'
NAVY = colors.HexColor('#0c1938')
BLUE = colors.HexColor('#173ead')
RED = colors.HexColor('#c8192d')
MUTED = colors.HexColor('#52617e')
LINE = colors.HexColor('#e2e8f6')
PALE = colors.HexColor('#f3f6fd')


def directory_records():
    seed = SQL.read_text(encoding='utf-8')
    inserts = seed[seed.index('INSERT INTO "DcseFaculty"'):seed.rindex('COMMIT;')]
    # SQLite decodes the SQL-escaped strings. Store the simple email arrays as
    # comma-separated strings for the report.
    def flatten_array(match):
        emails = [value.replace("''", "'") for value in re.findall(r"'((?:[^']|'')*)'", match.group(1))]
        return "'" + ','.join(emails).replace("'", "''") + "'"

    inserts = re.sub(r"ARRAY\[((?:\s*'(?:[^']|'')*'\s*,?)*?)\](?:::text\[\])?", flatten_array, inserts)
    with sqlite3.connect(':memory:') as db:
        db.executescript('''
            CREATE TABLE DcseFaculty (email TEXT, name TEXT, designation TEXT, office TEXT, floor INTEGER);
            CREATE TABLE DcseResponsibility (id INTEGER, topic TEXT, coordinator TEXT, emails TEXT);
        ''')
        db.executescript(inserts)
        faculty = db.execute('SELECT name, designation, office, floor, email FROM DcseFaculty ORDER BY name, email').fetchall()
        coordinators = db.execute('SELECT topic, coordinator, emails FROM DcseResponsibility ORDER BY id').fetchall()
    return faculty, coordinators


def style(name, size, leading, color=NAVY, bold=False, align=0):
    return ParagraphStyle(name, fontName='Helvetica-Bold' if bold else 'Helvetica',
                          fontSize=size, leading=leading, textColor=color, alignment=align,
                          splitLongWords=True)


LABEL = style('label', 9, 12, RED, True)
TITLE = style('title', 27, 32, NAVY, True)
HEADING = style('heading', 19, 24, NAVY, True)
HINT = style('hint', 10, 15, MUTED)
NAV = style('navigation', 10, 14, BLUE, True)
NAME = style('name', 10, 13, NAVY, True)
TEXT = style('body', 9, 12, MUTED)
EMAIL = style('email', 9, 13, BLUE)
ROOM = style('room', 9, 12, NAVY, align=TA_RIGHT)
COL = style('column', 9, 13, colors.white, True)


def paragraph(value, paragraph_style):
    return Paragraph(escape(str(value)).replace('–', '-').replace('—', '-'), paragraph_style)


def email_links(emails):
    links = [f'<link href={quoteattr("mailto:" + email)} color="#173ead">{escape(email)}</link>'
             for email in emails if email]
    return Paragraph('<br/>'.join(links) if links else 'Email unavailable', EMAIL)


class DirectoryDocument(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and hasattr(flowable, 'directory_section'):
            key, title = flowable.directory_section
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(title, key, level=0)


def section(key, title):
    heading = paragraph(title, HEADING)
    heading.directory_section = (key, title)
    return heading


def list_table(headings, rows, widths):
    table = Table([[paragraph(item, COL) for item in headings], *rows], colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, PALE]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LINEBELOW', (0, 1), (-1, -1), .35, LINE),
    ]))
    return table


def page_frame(canvas, doc):
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 25, width, 25, fill=1, stroke=0)
    canvas.setFillColor(RED)
    canvas.rect(0, height - 25, 38, 25, fill=1, stroke=0)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(colors.white)
    canvas.drawString(48, height - 16, 'THAPAR CONNECT')
    canvas.setStrokeColor(LINE)
    canvas.line(38, 37, width - 38, 37)
    canvas.setFillColor(MUTED)
    canvas.setFont('Helvetica', 8)
    canvas.drawString(38, 24, 'DCSE Faculty and Coordinators')
    canvas.drawRightString(width - 38, 24, f'Page {doc.page}')


def main():
    faculty, coordinators = directory_records()
    if not faculty or not coordinators:
        raise ValueError('The directory seed must contain faculty and coordinators.')
    OUTPUT.parent.mkdir(exist_ok=True)
    doc = DirectoryDocument(str(OUTPUT), pagesize=A4, rightMargin=38, leftMargin=38, topMargin=45, bottomMargin=47,
                            title='Thapar Connect | DCSE Faculty and Coordinators', author='Thapar Connect')
    width = doc.width - 12
    faculty_rows = []
    for name, designation, office, floor, email in faculty:
        floor_label = 'Ground floor' if floor == 0 else f'Floor {floor}'
        faculty_rows.append([[paragraph(name, NAME), paragraph(designation, TEXT)], email_links([email]),
                             Paragraph(f'{escape(office)}<br/>{floor_label}', ROOM)])
    coordinator_rows = [[paragraph(topic, NAME), paragraph(name, TEXT), email_links(emails.split(','))]
                        for topic, name, emails in coordinators]
    story = [
        paragraph('COMPUTER SCIENCE & ENGINEERING', LABEL),
        paragraph('Faculty and coordinators', TITLE),
        Paragraph(f'<link href="#faculty" color="#173ead">{len(faculty)} faculty members</link>'
                  f'   |   <link href="#coordinators" color="#173ead">{len(coordinators)} coordinator assignments</link>', NAV),
        Spacer(1, 14), section('faculty', 'Faculty directory'),
        paragraph('Find names and designations, office locations, and clickable email addresses.', HINT),
        Spacer(1, 9), list_table(['Faculty member and designation', 'Email address', 'Office'], faculty_rows,
                                 [width - 265, 190, 75]),
        PageBreak(), section('coordinators', 'Coordinators'),
        paragraph('Find the faculty contact for a responsibility or department service.', HINT),
        Spacer(1, 9), list_table(['Responsibility', 'Coordinator', 'Email addresses'], coordinator_rows,
                                 [width - 345, 155, 190]),
    ]
    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    print(f'Wrote {len(faculty)} faculty and {len(coordinators)} coordinator assignments to {OUTPUT.name}')


if __name__ == '__main__':
    main()
