#!/usr/bin/env python3
"""
Generate sample documents for PM2 RAG pipeline (M0)
AND generate MongoDB seed data (tai_lieu collection)

Features:
- Generates PDF, DOCX, TXT files
- Realistic Vietnamese content
- Generates MongoDB seed data matching documents.service.ts schema
- Configurable number of documents

Run: python scripts/generate_sample_docs.py
Output: 
  - data/sample-docs/ (files)
  - infra/mongodb/init/02-seed-tai-lieu.js (MongoDB seed)
"""

import os
import random
import json
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ============================================================
# CONFIGURATION
# ============================================================

NUM_DOCUMENTS = 10  # Number of documents to generate

OUTPUT_DIR = "data/sample-docs"
MONGODB_SEED_DIR = "infra/mongodb/init"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(MONGODB_SEED_DIR, exist_ok=True)

random.seed(2024)

# ============================================================
# DATA POOLS
# ============================================================

DOCUMENT_TYPES = [
    {"type": "pdf_text", "category": "Giáo trình", "name": "Giáo trình"},
    {"type": "pdf_text", "category": "Giáo trình", "name": "Bài giảng"},
    {"type": "pdf_text", "category": "Tài liệu tham khảo", "name": "Tài liệu tham khảo"},
    {"type": "docx", "category": "Quy chế", "name": "Quy chế"},
    {"type": "docx", "category": "Nghiên cứu", "name": "Nghiên cứu"},
    {"type": "docx", "category": "Luận văn", "name": "Luận văn"},
    {"type": "docx", "category": "Đề cương", "name": "Đề cương môn học"},
    {"type": "txt", "category": "Bài giảng", "name": "Bài giảng"},
    {"type": "txt", "category": "Quy định", "name": "Quy định"},
    {"type": "txt", "category": "Nội quy", "name": "Nội quy"},
]

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

# Security levels (matching documents.service.ts)
SECURITY_LEVELS = ['public', 'internal', 'restricted', 'confidential']

# Scope types (matching documents.service.ts)
SCOPE_TYPES = ['all', 'role', 'department', 'custom']

USER_IDS = ['user-001', 'user-002', 'user-003', 'user-004', 'user-005']
ROLE_CODES = ['ADMIN', 'BGD', 'P2', 'GV', 'HV', 'KT']

# Content templates
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

def generate_quy_dinh_content():
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

# ============================================================
# DOCUMENT GENERATORS
# ============================================================

def generate_pdf_text(doc_info, output_dir):
    """Generate PDF using reportlab"""
    try:
        pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
        font_name = 'Arial'
    except:
        font_name = 'Helvetica'
    
    pdf_filename = f"{doc_info['doc_id']}.pdf"
    pdf_path = os.path.join(output_dir, pdf_filename)
    
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
    
    if doc_info['category'] == 'Quy chế':
        content = generate_quy_dinh_content()
    elif doc_info['category'] == 'Nghiên cứu':
        content = generate_research_content()
    elif doc_info['category'] == 'Luận văn':
        content = generate_luan_van_content()
    else:
        content = generate_chapter_content(random.randint(3, 5))
    
    for line in content.split('\n'):
        if line.strip():
            story.append(Paragraph(line, body_style))
        else:
            story.append(Spacer(1, 6))
    
    doc.build(story)
    return pdf_path, pdf_filename

def generate_docx(doc_info, output_dir):
    """Generate a DOCX file"""
    doc = Document()
    
    title = doc.add_heading(doc_info['title'], 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph(f"Phân loại: {doc_info['category']}")
    doc.add_paragraph(f"Nguồn: {doc_info['department_name']}")
    doc.add_paragraph(f"Ngày tạo: {datetime.now().strftime('%d/%m/%Y')}")
    doc.add_paragraph("")
    
    if doc_info["category"] == "Đề cương":
        doc.add_heading("Đề cương môn học", 1)
        doc.add_paragraph(f"Môn học: {random.choice(SUBJECTS)}")
        doc.add_paragraph(f"Số tín chỉ: {random.randint(2, 4)}")
        doc.add_paragraph(f"Số tiết: {random.choice([30, 45, 60])}")
        doc.add_heading("Nội dung chi tiết", 1)
        for chapter in random.sample(CHAPTER_TOPICS, random.randint(3, 5)):
            doc.add_paragraph(chapter, style='List Bullet')
            doc.add_paragraph(generate_paragraph_sentences(2), style='List Bullet')
    elif doc_info["category"] == "Quy chế":
        doc.add_heading("Nội dung", 1)
        doc.add_paragraph(generate_quy_dinh_content())
    elif doc_info["category"] == "Nghiên cứu":
        doc.add_heading("Nội dung", 1)
        doc.add_paragraph(generate_research_content())
    elif doc_info["category"] == "Luận văn":
        doc.add_heading("Nội dung", 1)
        doc.add_paragraph(generate_luan_van_content())
    else:
        doc.add_heading("Nội dung", 1)
        doc.add_paragraph(generate_chapter_content(random.randint(2, 4)))
    
    filename = f"{doc_info['doc_id']}.docx"
    filepath = os.path.join(output_dir, filename)
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
    
    if doc_info["category"] in ["Nội quy", "Quy định"]:
        lines.append(generate_quy_dinh_content())
    else:
        lines.append(generate_chapter_content(random.randint(2, 4)))
    
    filename = f"{doc_info['doc_id']}.txt"
    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return filepath, filename

# ============================================================
# MONGODB SEED GENERATOR
# ============================================================

def generate_mongodb_seed(documents):
    """Generate MongoDB seed file (tai_lieu collection)"""

    now = datetime.now()
    now_str = now.isoformat()
    
    # Generate JavaScript seed file directly
    js_content = """// =====================================================
// MongoDB Seed Data - tai_lieu collection
// Auto-generated by scripts/generate_sample_docs.py
// =====================================================

if (db.documents.countDocuments() === 0) {
    db.documents.insertMany([
"""
    
    for i, doc_info in enumerate(documents):
        # Generate access scope based on document type
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
        
        # Determine security level based on category
        if doc_info['category'] in ['Quy chế', 'Luận văn']:
            security_level = 'restricted'
        elif doc_info['category'] in ['Nghiên cứu']:
            security_level = 'confidential'
        else:
            security_level = random.choice(['public', 'internal'])
        
        # Get file extension
        file_ext = doc_info['file_type']
        if file_ext == 'pdf_text':
            file_ext = 'pdf'
            mime_type = 'application/pdf'
        elif file_ext == 'txt':
            file_ext = 'txt'
            mime_type = 'text/plain'
        else:
            file_ext = 'docx'
            mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        
        doc_str = f"""      {{
        "docId": "{doc_info['doc_id']}",
        "title": "{doc_info['title']}",
        "category": "{doc_info['category']}",
        "originalName": "{doc_info['title'].replace(' ', '_')}.{file_ext}",
        "storedName": "{doc_info['doc_id']}.{file_ext}",
        "storagePath": "../../data/sample-docs/{doc_info['doc_id']}.{file_ext}",
        "mimeType": "{mime_type}",
        "size": {random.randint(100000, 5000000)},
        "securityLevel": "{security_level}",
        "scopeType": "{scope_type}",
        "accessRoleCodes": {json.dumps(access_role_codes)},
        "accessDepartmentCodes": {json.dumps(access_department_codes)},
        "accessUserIds": {json.dumps(access_user_ids)},
        "uploadedById": "{random.choice(USER_IDS)}",
        "uploadedByName": "Người dùng mẫu",
        "createdAt": new Date("{now_str}"),
        "ingestStatus": "pending",
        "ingestStage": "queued",
        "ingestUpdatedAt": new Date("{now_str}")
    }}"""
        
        if i < len(documents) - 1:
            js_content += doc_str + ",\n"
        else:
            js_content += doc_str + "\n"
    
    js_content += """   ]);
}

// Create indexes
db.documents.createIndex({ createdAt: -1 });
db.documents.createIndex({ docId: 1 });
"""
    
    # Write seed file
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
    
    documents_meta = []
    doc_id = 1
    
    for _ in range(NUM_DOCUMENTS):
        doc_type_info = random.choice(DOCUMENT_TYPES)
        doc_type = doc_type_info["type"]
        category = doc_type_info["category"]
        type_name = doc_type_info["name"]
        
        dept = random.choice(DEPARTMENTS)
        
        # Generate title based on category
        if category in ["Giáo trình", "Tài liệu tham khảo", "Bài giảng"]:
            title = f"{random.choice(SUBJECTS)} - {type_name} {random.randint(1, 3)}"
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
            ])
        elif category == "Luận văn":
            title = random.choice([
                "Luận văn ứng dụng AI trong đào tạo",
                "Luận văn phân tích dữ liệu giáo dục",
                "Luận văn xây dựng hệ thống hỏi đáp thông minh",
            ])
        else:
            title = f"{type_name} {random.randint(1, 100)}"
        
        doc_info = {
            "doc_id": f"DOC-{datetime.now().strftime('%Y%m%d')}-{doc_id:04d}",
            "title": title,
            "category": category,
            "department_code": dept["code"],
            "department_name": dept["name"],
            "file_type": doc_type,
            "type_name": type_name,
        }
        
        # Generate the actual file
        if doc_type == "pdf_text":
            filepath, filename = generate_pdf_text(doc_info, OUTPUT_DIR)
        elif doc_type == "docx":
            filepath, filename = generate_docx(doc_info, OUTPUT_DIR)
        else:  # txt
            filepath, filename = generate_txt(doc_info, OUTPUT_DIR)
        
        documents_meta.append(doc_info)
        print(f"  Generated: {filename} ({doc_type})")
        
        doc_id += 1
    
    # Generate MongoDB seed file
    seed_path = generate_mongodb_seed(documents_meta)
    print(f"\nMongoDB seed generated: {seed_path}")
    
    print("\n" + "=" * 60)
    print(f"Generated {len(documents_meta)} documents in '{OUTPUT_DIR}/'")
    print(f"Files location: {os.path.abspath(OUTPUT_DIR)}")
    print(f"MongoDB seed: {os.path.abspath(seed_path)}")
    print("=" * 60)

if __name__ == "__main__":
    main()