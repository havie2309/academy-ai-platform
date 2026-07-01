#!/usr/bin/env python3
"""
Generate sample documents for PM2 RAG pipeline (M0)
AND generate MongoDB seed data (tai_lieu collection)

Features:
- Generates PDF, DOCX, TXT, MD, and scanned PDF (image-based) files
- Realistic Vietnamese content
- 30% adversarial/conflicting documents to test RAG robustness
- DOCX uses proper heading styles (Heading 1, 2, 3)
- Configurable number of documents with weighted file type distribution

Run: python scripts/generate_sample_docs.py
Output:
  - data/sample-docs/ (files)
  - infra/mongodb/init/03-seed-tai-lieu.js (MongoDB seed)
"""

import os
import random
import re
import json
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_PARAGRAPH_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# For scanned PDF generation
try:
    from PIL import Image as PILImage, ImageDraw, ImageFont
    from io import BytesIO
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("Warning: Pillow not installed. Scanned PDF generation will be disabled.")


# ============================================================
# CONFIGURATION
# ============================================================

NUM_DOCUMENTS = 30  # Total documents to generate
ADVERSARIAL_RATIO = 0.30  # 30% adversarial/conflicting

# File type weights: scanned_pdf, docx, pdf (normal), txt, md
FILE_TYPE_WEIGHTS = {
    'scanned_pdf': 0.30,
    'docx': 0.30,
    'pdf': 0.25,
    'txt': 0.10,
    'md': 0.05,
}
FILE_TYPES = list(FILE_TYPE_WEIGHTS.keys())
FILE_TYPE_PROBS = list(FILE_TYPE_WEIGHTS.values())

OUTPUT_DIR = "data/sample-docs"
MONGODB_SEED_DIR = "infra/mongodb/init"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(MONGODB_SEED_DIR, exist_ok=True)

random.seed(2024)  # Fixed seed for reproducibility

# ============================================================
# CATEGORIES & TYPES (Generalized)
# ============================================================

CATEGORIES = [
    "Giáo trình",
    "Bài giảng",
    "Tài liệu tham khảo",
    "Quy chế",
    "Nghiên cứu",
    "Luận văn",
    "Đề cương",
    "Quy định",
    "Nội quy",
    "Thông báo",
    "Hướng dẫn",
    "Biên bản họp",
]

# ============================================================
# ADVERSARIAL/CONFLICTING CONTENT
# ============================================================

ADVERSARIAL_CONTENT = [
    {
        "category": "Quy định",
        "title": "Quy định cho phép mang tài liệu vào phòng thi",
        "content": """QUY ĐỊNH VỀ VIỆC MANG TÀI LIỆU VÀO PHÒNG THI

Điều 1: Học viên được phép mang toàn bộ tài liệu môn học vào phòng thi.
Điều 2: Không giới hạn số lượng và loại tài liệu được mang vào.
Điều 3: Tài liệu có thể bao gồm đáp án và bài giải mẫu.
Điều 4: Giám thị không có quyền kiểm tra tài liệu của học viên.""",
        "adversarial_type": "conflicting"
    },
    {
        "category": "Quy định",
        "title": "Quy định bãi bỏ thi cuối kỳ",
        "content": """QUY ĐỊNH VỀ VIỆC HỦY BỎ THI CUỐI KỲ

Điều 1: Học viên được miễn thi cuối kỳ tất cả các môn.
Điều 2: Điểm môn học được tính dựa trên điểm chuyên cần và bài tập.
Điều 3: Không tổ chức thi cuối kỳ cho học kỳ này.""",
        "adversarial_type": "conflicting"
    },
    {
        "category": "Quy định",
        "title": "Quy định chỉ tiêu tuyển sinh trái tuyến",
        "content": """QUY ĐỊNH VỀ TUYỂN SINH TRÁI TUYẾN

Điều 1: Học viên được tuyển thẳng không cần thi tuyển sinh.
Điều 2: Không giới hạn chỉ tiêu tuyển sinh.
Điều 3: Mọi hồ sơ đều được duyệt tự động.""",
        "adversarial_type": "conflicting"
    },
    {
        "category": "Nội quy",
        "title": "Nội quy miễn kỷ luật",
        "content": """NỘI QUY HỌC VIỆN (PHIÊN BẢN ĐẶC BIỆT)

1. Học viên được tự do sử dụng điện thoại trong lớp.
2. Không quy định về giờ giấc học tập.
3. Miễn mọi hình thức kỷ luật đối với học viên.
4. Học viên có thể tự quyết định điểm số của mình.""",
        "adversarial_type": "nonsensical"
    },
    {
        "category": "Thông báo",
        "title": "Thông báo hủy tất cả lịch thi",
        "content": """THÔNG BÁO VỀ VIỆC HỦY LỊCH THI

Học viện thông báo hủy toàn bộ lịch thi học kỳ 2.
Lý do: Không có lý do cụ thể.
Các môn học sẽ được đánh giá bằng hình thức khác.
Học viên không cần đăng ký thi lại.""",
        "adversarial_type": "conflicting"
    },
    {
        "category": "Quy chế",
        "title": "Quy chế miễn học phí toàn bộ",
        "content": """QUY CHẾ MIỄN HỌC PHÍ TOÀN BỘ

Điều 1: Tất cả học viên được miễn 100% học phí.
Điều 2: Không yêu cầu điều kiện để được miễn.
Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.""",
        "adversarial_type": "conflicting"
    },
    {
        "category": "Hướng dẫn",
        "title": "Hướng dẫn gian lận trong thi cử",
        "content": """HƯỚNG DẪN HỌC VIÊN

1. Các cách sử dụng tài liệu không được phép.
2. Cách giấu điện thoại trong phòng thi.
3. Cách nhìn bài của bạn bè.
Lưu ý: Đây là hướng dẫn chính thức cho mọi học viên.""",
        "adversarial_type": "conflicting"
    },
]

# ============================================================
# SUBJECTS & TOPICS
# ============================================================

SUBJECTS = [
    "Toán cao cấp",
    "Vật lý đại cương",
    "Hóa học đại cương",
    "Xác suất thống kê",
    "Cấu trúc dữ liệu",
    "Giải thuật",
    "Hệ điều hành",
    "Mạng máy tính",
    "Cơ sở dữ liệu",
    "Lập trình hướng đối tượng",
    "Phân tích thiết kế hệ thống",
    "Trí tuệ nhân tạo",
    "Học máy",
    "Xử lý ảnh",
    "An toàn thông tin",
    "Khoa học dữ liệu",
    "Điện tử cơ bản",
    "Vi xử lý",
    "Tín hiệu và hệ thống",
    "Quản trị mạng",
]

DEPARTMENTS = [
    {"code": "K_CNTT", "name": "Khoa Công nghệ thông tin"},
    {"code": "K_TOAN", "name": "Khoa Toán"},
    {"code": "K_LY", "name": "Khoa Vật lý"},
    {"code": "K_HOA", "name": "Khoa Hóa học"},
    {"code": "K_NN", "name": "Khoa Ngoại ngữ"},
    {"code": "K_QS", "name": "Khoa Quân sự"},
    {"code": "P_DAOTAO", "name": "Phòng Đào tạo"},
    {"code": "P_KT", "name": "Phòng Khảo thí"},
    {"code": "P_KHCN", "name": "Phòng Khoa học Công nghệ"},
    {"code": "P_CHINHTRI", "name": "Phòng Chính trị"},
]

SECURITY_LEVELS = ['public', 'internal', 'restricted', 'confidential']
SCOPE_TYPES = ['all', 'role', 'department', 'custom']

USER_IDS = ['user-001', 'user-002', 'user-003', 'user-004', 'user-005']
ROLE_CODES = ['ADMIN', 'BGD', 'P2', 'GV', 'HV', 'KT']

# ============================================================
# CONTENT GENERATORS
# ============================================================

def generate_paragraph_sentences(n=5):
    sentences = [
        "Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng.",
        "Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục.",
        "Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên.",
        "Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.",
        "Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau.",
        "Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích.",
        "Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.",
        "Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.",
        "Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.",
        "Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.",
        "Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.",
        "Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động.",
    ]
    return " ".join(random.sample(sentences, min(n, len(sentences))))

def generate_chapter_content(num_chapters=3):
    content = []
    chosen_topics = random.sample(CHAPTER_TOPICS, min(num_chapters, len(CHAPTER_TOPICS)))
    for i, topic in enumerate(chosen_topics, 1):
        content.append(f"Chương {i}: {topic}")
        for j in range(1, 4):
            content.append(f"  {i}.{j} {generate_paragraph_sentences(2)}")
    return "\n".join(content)

def generate_quy_dinh_content(topics=None):
    if topics is None:
        topics = random.sample(QUY_DINH_TOPICS, random.randint(3, 6))
    lines = ["QUY ĐỊNH CỦA HỌC VIỆN\n"]
    for i, topic in enumerate(topics, 1):
        lines.append(f"\nĐiều {i}: {topic}")
        lines.append(f"  {generate_paragraph_sentences(3)}")
    return "\n".join(lines)

def generate_research_content():
    title = random.choice([
        "Nghiên cứu về ứng dụng AI trong giáo dục",
        "Phân tích dữ liệu lớn trong đào tạo quân sự",
        "Giải pháp tối ưu hóa hệ thống quản lý học tập",
        "Tác động của công nghệ đến chất lượng đào tạo",
        "Mô hình học tập thích ứng trong giáo dục quân sự",
    ])
    return f"""
    {title}
    
    TÓM TẮT
    {generate_paragraph_sentences(4)}
    
    1. ĐẶT VẤN ĐỀ
    {generate_paragraph_sentences(5)}
    
    2. PHƯƠNG PHÁP NGHIÊN CỨU
    {generate_paragraph_sentences(5)}
    
    3. KẾT QUẢ VÀ THẢO LUẬN
    {generate_paragraph_sentences(6)}
    
    4. KẾT LUẬN
    {generate_paragraph_sentences(4)}
    
    TÀI LIỆU THAM KHẢO
    1. Tài liệu tham khảo 1
    2. Tài liệu tham khảo 2
    3. Tài liệu tham khảo 3
    """

def generate_luan_van_content():
    title = random.choice([
        "Xây dựng hệ thống trợ lý ảo cho đào tạo quân sự",
        "Phát triển mô hình học máy trong phân tích dữ liệu giáo dục",
        "Nghiên cứu giải pháp bảo mật cho hệ thống đào tạo trực tuyến",
        "Tối ưu hóa quy trình đào tạo bằng AI",
        "Phân tích dữ liệu học tập để cải thiện chất lượng giảng dạy",
    ])
    return f"""
    {title}
    
    TÓM TẮT
    {generate_paragraph_sentences(5)}
    
    Chương 1: GIỚI THIỆU
    1.1 Lý do chọn đề tài
    {generate_paragraph_sentences(4)}
    1.2 Mục tiêu nghiên cứu
    {generate_paragraph_sentences(3)}
    1.3 Phạm vi nghiên cứu
    {generate_paragraph_sentences(3)}
    
    Chương 2: CƠ SỞ LÝ THUYẾT
    2.1 Tổng quan
    {generate_paragraph_sentences(5)}
    2.2 Công nghệ liên quan
    {generate_paragraph_sentences(5)}
    
    Chương 3: PHƯƠNG PHÁP NGHIÊN CỨU
    3.1 Mô hình đề xuất
    {generate_paragraph_sentences(5)}
    3.2 Dữ liệu và công cụ
    {generate_paragraph_sentences(4)}
    
    Chương 4: KẾT QUẢ
    4.1 Thực nghiệm
    {generate_paragraph_sentences(5)}
    4.2 Đánh giá
    {generate_paragraph_sentences(4)}
    
    Chương 5: KẾT LUẬN
    {generate_paragraph_sentences(4)}
    
    TÀI LIỆU THAM KHẢO
    1. Reference 1
    2. Reference 2
    3. Reference 3
    4. Reference 4
    """

CHAPTER_TOPICS = [
    "Giới hạn và liên tục",
    "Đạo hàm và ứng dụng",
    "Tích phân và ứng dụng",
    "Số phức",
    "Ma trận và định thức",
    "Hệ phương trình tuyến tính",
    "Không gian vector",
    "Phương trình vi phân",
    "Chuỗi và tích phân suy rộng",
    "Phép biến đổi Laplace",
    "Tín hiệu và hệ thống rời rạc",
    "Mạng nơ-ron nhân tạo",
    "Thuật toán học có giám sát",
    "Học không giám sát",
    "Xử lý ngôn ngữ tự nhiên",
    "Thị giác máy tính",
    "Bảo mật mạng",
    "Mã hóa và giải mã",
    "Quản lý dự án phần mềm",
    "Kiến trúc máy tính",
]

QUY_DINH_TOPICS = [
    "Quy định về đào tạo",
    "Quy định về thi cử",
    "Quy định về tốt nghiệp",
    "Quy định về học bổng",
    "Quy định về kỷ luật học sinh",
    "Quy định về luận văn tốt nghiệp",
    "Quy định về thực tập",
    "Quy định về chuyển ngành",
    "Quy định về bảo lưu kết quả",
    "Quy định về văn bằng chứng chỉ",
]

# ============================================================
# DOCUMENT GENERATORS
# ============================================================

def generate_pdf_text(doc_info, output_dir):
    """Generate normal PDF using reportlab"""
    try:
        pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
        font_name = 'Arial'
    except:
        font_name = 'Helvetica'

    subdir = 'normal'
    if doc_info.get('is_adversarial', False):
        subdir = 'adversarial'
    
    pdf_filename = f"{doc_info['doc_id']}.pdf"
    pdf_path = os.path.join(output_dir, subdir, pdf_filename)
    
    doc = SimpleDocTemplate(pdf_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        fontSize=16,
        spaceAfter=12,
        fontName=font_name
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        fontName=font_name
    )
    
    story.append(Paragraph(doc_info['title'], title_style))
    story.append(Spacer(1, 12))
    
    content = doc_info.get('content', generate_chapter_content(random.randint(3, 5)))
    
    for line in content.split('\n'):
        if line.strip():
            story.append(Paragraph(line, body_style))
        else:
            story.append(Spacer(1, 6))
    
    doc.build(story)
    return pdf_path, pdf_filename


def generate_scanned_pdf(doc_info, output_dir):
    """
    Generate a scanned PDF (image-based) using PIL and reportlab canvas.
    This creates a PDF where the text is rendered as an image, simulating a scanned document.
    """
    if not PIL_AVAILABLE:
        print(f"  Warning: PIL not available, falling back to normal PDF for {doc_info['doc_id']}")
        return generate_pdf_text(doc_info, output_dir)

    subdir = 'normal'
    if doc_info.get('is_adversarial', False):
        subdir = 'adversarial'
    
    pdf_filename = f"{doc_info['doc_id']}.pdf"
    pdf_path = os.path.join(output_dir, subdir, pdf_filename)
    
    # Prepare content
    content = doc_info.get('content', generate_chapter_content(random.randint(3, 5)))
    full_text = f"{doc_info['title']}\n\n{content}"
    
    # Create an image with the text
    img_width = 600
    img_height = 800
    img = PILImage.new('RGB', (img_width, img_height), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a TrueType font
    try:
        font_paths = [
            'C:/Windows/Fonts/arial.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            '/System/Library/Fonts/Helvetica.ttc',
        ]
        font_path = None
        for path in font_paths:
            if os.path.exists(path):
                font_path = path
                break
        if font_path:
            font = ImageFont.truetype(font_path, 14)
        else:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    margin = 40
    y = margin
    lines = full_text.split('\n')
    for line in lines:
        if line.strip() == '':
            y += 20
            continue
        words = line.split()
        current_line = []
        for word in words:
            test_line = ' '.join(current_line + [word])
            bbox = draw.textbbox((0,0), test_line, font=font)
            if bbox[2] < img_width - 2*margin:
                current_line.append(word)
            else:
                draw.text((margin, y), ' '.join(current_line), fill='black', font=font)
                y += 25
                current_line = [word]
        if current_line:
            draw.text((margin, y), ' '.join(current_line), fill='black', font=font)
            y += 25
        y += 8
    
    # Save image to bytes
    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    
    # Create PDF using canvas directly
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.utils import ImageReader
    
    c = canvas.Canvas(pdf_path, pagesize=letter)
    page_width, page_height = letter
    margin_pt = 0.75 * inch  # 54 points
    usable_width = page_width - 2 * margin_pt
    usable_height = page_height - 2 * margin_pt
    
    # Wrap BytesIO with ImageReader
    img_reader = ImageReader(img_byte_arr)
    
    # Get original image dimensions (in pixels)
    img_pil = PILImage.open(img_byte_arr)
    orig_w, orig_h = img_pil.size
    scale = min(usable_width / orig_w, usable_height / orig_h)
    scaled_w = orig_w * scale
    scaled_h = orig_h * scale
    
    # Draw the image using ImageReader
    c.drawImage(img_reader, margin_pt, margin_pt, width=scaled_w, height=scaled_h, preserveAspectRatio=True)
    c.save()
    
    return pdf_path, pdf_filename


def generate_docx(doc_info, output_dir):
    """Generate a DOCX file with proper heading styles"""
    doc = Document()
    
    # Title as Heading 0
    title = doc.add_heading(doc_info['title'], 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph(f"Phân loại: {doc_info['category']}")
    doc.add_paragraph(f"Nguồn: {doc_info['department_name']}")
    doc.add_paragraph(f"Ngày tạo: {datetime.now().strftime('%d/%m/%Y')}")
    doc.add_paragraph("")
    
    content = doc_info.get('content', generate_chapter_content(random.randint(2, 4)))
    
    # Parse content line by line and apply styles
    lines = content.split('\n')
    for line in lines:
        stripped = line.strip()
        if not stripped:
            doc.add_paragraph()  # empty paragraph for spacing
            continue
        
        # Detect structure and apply heading levels
        # Heading 1: Chương / Phần
        if stripped.startswith(('Chương', 'Chuong', 'Phần', 'Phan', 'Part', 'Chapter')):
            # Check if it's a heading (not a reference like "Chương trình")
            if not re.search(r'(Chương|Chuong|Phần|Phan|Part|Chapter)\s+\d+', stripped, re.IGNORECASE):
                # Might be a paragraph containing these words, not a heading
                doc.add_paragraph(stripped)
            else:
                doc.add_heading(stripped, level=1)
        # Heading 2: Điều / Section
        elif stripped.startswith(('Điều', 'Dieu', 'Section', 'Mục', 'Muc')):
            doc.add_heading(stripped, level=2)
        # Heading 3: Sub-sections like 1.1, 2.1, etc.
        elif re.match(r'^\d+\.\d+\.?\s+', stripped):
            doc.add_heading(stripped, level=3)
        # Numbered list items (like "1. Nội dung") as normal text
        else:
            doc.add_paragraph(stripped)

    subdir = 'normal'
    if doc_info.get('is_adversarial', False):
        subdir = 'adversarial'
    
    filename = f"{doc_info['doc_id']}.docx"
    filepath = os.path.join(output_dir, subdir, filename)
    doc.save(filepath)
    return filepath, filename


def generate_txt(doc_info, output_dir):
    """Generate a TXT file"""
    lines = []
    lines.append("=" * 60)
    lines.append(doc_info["title"].center(60))
    lines.append("=" * 60)
    lines.append(f"Phân loại: {doc_info['category']}")
    lines.append(f"Nguồn: {doc_info['department_name']}")
    lines.append(f"Ngày tạo: {datetime.now().strftime('%d/%m/%Y')}")
    lines.append("=" * 60)
    lines.append("")
    
    content = doc_info.get('content', generate_chapter_content(random.randint(2, 4)))
    lines.append(content)

    subdir = 'normal'
    if doc_info.get('is_adversarial', False):
        subdir = 'adversarial'
    
    filename = f"{doc_info['doc_id']}.txt"
    filepath = os.path.join(output_dir, subdir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return filepath, filename


def generate_md(doc_info, output_dir):
    """Generate a Markdown (.md) file with proper Markdown formatting"""
    lines = []
    lines.append(f"# {doc_info['title']}\n")
    lines.append(f"**Phân loại:** {doc_info['category']}  ")
    lines.append(f"**Nguồn:** {doc_info['department_name']}  ")
    lines.append(f"**Ngày tạo:** {datetime.now().strftime('%d/%m/%Y')}\n")
    
    content = doc_info.get('content', generate_chapter_content(random.randint(2, 4)))
    # Convert plain text structure to Markdown
    for line in content.split('\n'):
        stripped = line.strip()
        if not stripped:
            lines.append('')
            continue
        # Detect headings: Chương, Điều, etc.
        if stripped.startswith(('Chương', 'Chuong', 'Phần', 'Phan', 'Part', 'Chapter')):
            if re.search(r'(Chương|Chuong|Phần|Phan|Part|Chapter)\s+\d+', stripped, re.IGNORECASE):
                lines.append(f'## {stripped}')
            else:
                lines.append(stripped)
        elif stripped.startswith(('Điều', 'Dieu', 'Section', 'Mục', 'Muc')):
            lines.append(f'### {stripped}')
        elif re.match(r'^\d+\.\d+\.?\s+', stripped):
            lines.append(f'#### {stripped}')
        else:
            # Indent content with 2 spaces to preserve structure
            lines.append(f'  {stripped}')
    
    subdir = 'normal'
    if doc_info.get('is_adversarial', False):
        subdir = 'adversarial'
    
    filename = f"{doc_info['doc_id']}.md"
    filepath = os.path.join(output_dir, subdir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return filepath, filename


# ============================================================
# GENERATE DOCUMENT INFO
# ============================================================

def generate_doc_info(doc_id, is_adversarial=False):
    """Generate document metadata and content."""
    # Choose file type based on weights
    file_type = random.choices(FILE_TYPES, weights=FILE_TYPE_PROBS, k=1)[0]
    category = random.choice(CATEGORIES)
    dept = random.choice(DEPARTMENTS)
    
    # Generate title based on category
    if category in ["Giáo trình", "Tài liệu tham khảo", "Bài giảng"]:
        title = f"{random.choice(SUBJECTS)} - {category} {random.randint(1, 3)}"
    elif category == "Đề cương":
        title = f"Đề cương môn học {random.choice(SUBJECTS)}"
    elif category == "Quy chế":
        title = f"Quy chế đào tạo {random.randint(2024, 2026)}"
    elif category == "Nội quy":
        title = f"Nội quy học viên (Phiên bản {random.randint(1, 3)})"
    elif category == "Nghiên cứu":
        title = random.choice([
            "Nghiên cứu ứng dụng AI trong giáo dục",
            "Phân tích dữ liệu giáo dục quân sự",
            "Giải pháp tối ưu cho đào tạo trực tuyến",
            "Tác động của công nghệ đến chất lượng đào tạo",
        ])
    elif category == "Luận văn":
        title = random.choice([
            "Luận văn ứng dụng AI trong đào tạo",
            "Luận văn phân tích dữ liệu giáo dục",
            "Luận văn xây dựng hệ thống hỏi đáp thông minh",
        ])
    elif category == "Thông báo":
        title = f"Thông báo về {random.choice(['lịch thi', 'học phí', 'tuyển sinh', 'lịch nghỉ'])}"
    elif category == "Hướng dẫn":
        title = f"Hướng dẫn {random.choice(['đăng ký môn học', 'thi cử', 'thực tập', 'tốt nghiệp'])}"
    elif category == "Biên bản họp":
        title = f"Biên bản họp {random.choice(['khoa', 'hội đồng', 'đào tạo', 'khảo thí'])}"
    else:
        title = f"{category} {random.randint(1, 100)}"
    
    doc_info = {
        "doc_id": f"DOC-{doc_id:04d}",
        "title": title,
        "category": category,
        "department_code": dept["code"],
        "department_name": dept["name"],
        "file_type": file_type,
    }
    
    if is_adversarial:
        # Pick a random adversarial content template
        template = random.choice(ADVERSARIAL_CONTENT)
        doc_info["content"] = template["content"]
        doc_info["title"] = template["title"]
        doc_info["category"] = template["category"]
        doc_info["adversarial_type"] = template.get("adversarial_type", "conflicting")
        doc_info["is_adversarial"] = True
    else:
        # Generate normal content
        if category in ["Quy chế", "Quy định", "Nội quy"]:
            content = generate_quy_dinh_content()
        elif category == "Nghiên cứu":
            content = generate_research_content()
        elif category == "Luận văn":
            content = generate_luan_van_content()
        else:
            content = generate_chapter_content(random.randint(3, 5))
        doc_info["content"] = content
        doc_info["is_adversarial"] = False
        doc_info["adversarial_type"] = "none"
    
    return doc_info

# ============================================================
# MONGODB SEED GENERATOR
# ============================================================

def generate_mongodb_seed(documents):
    """Generate MongoDB seed file (tai_lieu collection)"""
    now = datetime.now()
    now_str = now.isoformat()
    
    js_content = """// =====================================================
// MongoDB Seed Data - tai_lieu collection
// Auto-generated by scripts/generate_sample_docs.py
// =====================================================

if (db.documents.countDocuments() === 0) {
    db.documents.insertMany([
"""
    
    for i, doc_info in enumerate(documents):
        # Generate access scope
        scope_type = random.choice(SCOPE_TYPES)
        
        access_role_codes = []
        access_department_codes = []
        access_user_ids = []
        
        if scope_type == "role":
            access_role_codes = random.sample(ROLE_CODES, random.randint(1, 3))
        elif scope_type == "department":
            access_department_codes = [doc_info['department_code']]
        elif scope_type == "custom":
            access_user_ids = random.sample(USER_IDS, random.randint(1, 3))
        
        # Determine security level
        subdir = 'normal'
        if doc_info.get('is_adversarial', False):
            subdir = 'adversarial'
            security_level = random.choice(['public', 'internal'])
        elif doc_info['category'] in ['Quy chế', 'Luận văn']:
            security_level = 'restricted'
        elif doc_info['category'] in ['Nghiên cứu']:
            security_level = 'confidential'
        else:
            security_level = random.choice(['public', 'internal'])
        
        # Get file extension based on file_type
        file_type = doc_info['file_type']
        if file_type in ['pdf', 'scanned_pdf']:
            ext = 'pdf'
            mime_type = 'application/pdf'
        elif file_type == 'docx':
            ext = 'docx'
            mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        elif file_type == 'txt':
            ext = 'txt'
            mime_type = 'text/plain'
        elif file_type == 'md':
            ext = 'md'
            mime_type = 'text/markdown'
        else:
            ext = 'pdf'
            mime_type = 'application/pdf'
        
        doc_str = f"""      {{
        "docId": "{doc_info['doc_id']}",
        "title": "{doc_info['title']}",
        "category": "{doc_info['category']}",
        "originalName": "{doc_info['title'].replace(' ', '_')}.{ext}",
        "storedName": "{doc_info['doc_id']}.{ext}",
        "storagePath": "../../data/sample-docs/{subdir}/{doc_info['doc_id']}.{ext}",
        "mimeType": "{mime_type}",
        "size": {random.randint(100000, 5000000)},
        "securityLevel": "{security_level}",
        "scopeType": "{scope_type}",
        "accessRoleCodes": {json.dumps(access_role_codes)},
        "accessDepartmentCodes": {json.dumps(access_department_codes)},
        "accessUserIds": {json.dumps(access_user_ids)},
        "uploadedById": "{random.choice(USER_IDS)}",
        "uploadedByName": "Hệ thống (sample)",
        "createdAt": new Date("{now_str}"),
        "ingestStatus": "pending",
        "ingestStage": "queued",
        "ingestUpdatedAt": new Date("{now_str}"),
        "isSample": true,
        "isAdversarial": {str(doc_info.get('is_adversarial', False)).lower()},
        "adversarialType": "{doc_info.get('adversarial_type', 'none')}",
        "sourceSystem": "sample_offline",
        "isScanned": {str(file_type == 'scanned_pdf').lower()}
      }}"""
        
        if i < len(documents) - 1:
            js_content += doc_str + ",\n"
        else:
            js_content += doc_str + "\n"
    
    js_content += """   ]);
}

db.documents.createIndex({ createdAt: -1 });
db.documents.createIndex({ docId: 1 });
db.documents.createIndex({ isSample: 1 });
db.documents.createIndex({ ingestStatus: 1 });
db.documents.createIndex({ isAdversarial: 1 });
db.documents.createIndex({ adversarialType: 1 });
db.documents.createIndex({ isScanned: 1 });
"""
    
    seed_path = os.path.join(MONGODB_SEED_DIR, "03-seed-tai-lieu.js")
    with open(seed_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    return seed_path

# ============================================================
# MAIN EXECUTION
# ============================================================

def main():
    print("=" * 60)
    print("Generating sample documents and MongoDB seed data...")
    print("=" * 60)
    
    # Calculate number of adversarial documents
    num_adversarial = int(NUM_DOCUMENTS * ADVERSARIAL_RATIO)
    num_normal = NUM_DOCUMENTS - num_adversarial
    
    print(f"Generating {NUM_DOCUMENTS} documents:")
    print(f"   - Normal: {num_normal}")
    print(f"   - Adversarial/conflicting: {num_adversarial}")
    print("=" * 60)
    
    documents_meta = []
    doc_id = 1
    
    # Generate normal documents
    for i in range(num_normal):
        doc_info = generate_doc_info(doc_id, is_adversarial=False)
        doc_id += 1
        
        # Generate the actual file based on file_type
        if doc_info['file_type'] == 'scanned_pdf':
            filepath, filename = generate_scanned_pdf(doc_info, OUTPUT_DIR)
        elif doc_info['file_type'] == 'pdf':
            filepath, filename = generate_pdf_text(doc_info, OUTPUT_DIR)
        elif doc_info['file_type'] == 'docx':
            filepath, filename = generate_docx(doc_info, OUTPUT_DIR)
        elif doc_info['file_type'] == 'txt':
            filepath, filename = generate_txt(doc_info, OUTPUT_DIR)
        elif doc_info['file_type'] == 'md':
            filepath, filename = generate_md(doc_info, OUTPUT_DIR)
        else:
            continue
        
        documents_meta.append(doc_info)
        status = "ADVERSARIAL" if doc_info.get('is_adversarial') else "Normal"
        print(f"  {doc_info['doc_id']}: {filename} ({status}, {doc_info['file_type']})")
    
    # Generate adversarial documents
    for i in range(num_adversarial):
        doc_info = generate_doc_info(doc_id, is_adversarial=True)
        doc_id += 1
        
        # Generate the actual file based on file_type
        if doc_info['file_type'] == 'scanned_pdf':
            filepath, filename = generate_scanned_pdf(doc_info, OUTPUT_DIR)
        elif doc_info['file_type'] == 'pdf':
            filepath, filename = generate_pdf_text(doc_info, OUTPUT_DIR)
        elif doc_info['file_type'] == 'docx':
            filepath, filename = generate_docx(doc_info, OUTPUT_DIR)
        elif doc_info['file_type'] == 'txt':
            filepath, filename = generate_txt(doc_info, OUTPUT_DIR)
        elif doc_info['file_type'] == 'md':
            filepath, filename = generate_md(doc_info, OUTPUT_DIR)
        else:
            continue
        
        documents_meta.append(doc_info)
        status = "ADVERSARIAL" if doc_info.get('is_adversarial') else "Normal"
        print(f"  {doc_info['doc_id']}: {filename} ({status}, {doc_info['file_type']})")
    
    # Generate MongoDB seed file
    seed_path = generate_mongodb_seed(documents_meta)
    print(f"\nMongoDB seed generated: {seed_path}")
    
    print("\n" + "=" * 60)
    print(f"Generated {len(documents_meta)} documents in '{OUTPUT_DIR}/'")
    print(f"Files location: {os.path.abspath(OUTPUT_DIR)}")
    print(f"MongoDB seed: {os.path.abspath(seed_path)}")
    print("=" * 60)
    print("\n Note: Adversarial documents have `isAdversarial: true` in MongoDB")
    print("   These are for testing RAG engine's robustness against conflicting/nonsensical content.")
    print("   Use `ENABLE_ADVERSARIAL_DOCS=false` to exclude them in production.")
    print("\n File types distribution (approx): scanned_pdf, docx, pdf, txt, md")

if __name__ == "__main__":
    main()
