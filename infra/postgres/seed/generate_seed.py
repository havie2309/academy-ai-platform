#!/usr/bin/env python3
"""
generate_seed.py - Complete seed data generator for PostgreSQL using Faker vi_VN.

This file generates BOTH:
1) Training/data warehouse seed data
2) Khao Thi module seed data

Usage:
    python generate_seed.py --output infra/postgres/init/02-seed.sql

Optional:
    python generate_seed.py --output infra/postgres/init/02-seed.sql --truncate
"""

import argparse
import random
from datetime import datetime, timedelta
from faker import Faker

fake = Faker("vi_VN")
Faker.seed(2024)
random.seed(2024)

# ============================================
# CONFIGURATION - TRAINING MODULE
# ============================================

NUM_NAM_HOC = 5
NUM_HOC_VIEN = 50
NUM_GIANG_VIEN = 20
NUM_MON_HOC = 80
NUM_LOP_HOC_PHAN = 120
NUM_DIEM = 600
NUM_KET_QUA_HOC_KY = 300

# ============================================
# CONFIGURATION - KHAO THI MODULE
# ============================================

NUM_FRAMEWORKS = 20
NUM_MATRICES = 30
NUM_KNOWLEDGE_BLOCKS = 60
NUM_QUESTION_BANKS = 25
NUM_QUESTIONS = 100
NUM_EXAM_BANKS = 15
NUM_SURVEY_TOPICS = 8
NUM_CLUSTER_SURVEYS = 12
NUM_SURVEY_GROUPS = 10
NUM_SURVEY_QUESTIONS = 60
NUM_SURVEYS = 15
NUM_SURVEY_SESSIONS = 120

FIRST_NAMES = [
    "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ",
    "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"
]
MIDDLE_NAMES = [
    "Văn", "Thị", "Hữu", "Đức", "Minh", "Thanh", "Ngọc",
    "Quang", "Phương", "Kim", "Bảo", "Tuấn", "Hải"
]
LAST_NAMES = [
    "Anh", "Bình", "Chiến", "Dũng", "Em", "Phúc", "Giang",
    "Hương", "Linh", "Minh", "Nguyệt", "Phương", "Quân",
    "Sơn", "Tùng", "Việt", "Xuân", "Yến", "Hoa", "Hạnh"
]

VIETNAM_CITIES = [
    "Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
    "Hải Dương", "Nam Định", "Thái Bình", "Ninh Bình", "Hà Nam",
    "Hưng Yên", "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình",
    "Quảng Trị", "Thừa Thiên Huế", "Quảng Nam", "Quảng Ngãi", "Bình Định",
    "Phú Yên", "Khánh Hòa", "Ninh Thuận", "Bình Thuận", "Kon Tum",
    "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng", "Bình Phước",
    "Tây Ninh", "Bình Dương", "Đồng Nai", "Bà Rịa - Vũng Tàu", "Long An",
    "Tiền Giang", "Bến Tre", "Trà Vinh", "Vĩnh Long", "Đồng Tháp",
    "An Giang", "Kiên Giang", "Cà Mau", "Bạc Liêu", "Sóc Trăng",
    "Hậu Giang", "Lai Châu", "Điện Biên", "Sơn La", "Hòa Bình",
    "Lào Cai", "Yên Bái", "Phú Thọ", "Vĩnh Phúc", "Bắc Ninh",
    "Bắc Giang", "Lạng Sơn", "Cao Bằng", "Bắc Kạn", "Thái Nguyên",
    "Tuyên Quang", "Hà Giang", "Quảng Ninh",
]

VIETNAM_DISTRICTS = [
    "Ba Đình", "Hoàn Kiếm", "Hai Bà Trưng", "Đống Đa", "Cầu Giấy",
    "Thanh Xuân", "Hoàng Mai", "Long Biên", "Bắc Từ Liêm", "Nam Từ Liêm",
    "Quận 1", "Quận 2", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7",
    "Quận 8", "Quận 9", "Quận 10", "Quận 11", "Quận 12", "Gò Vấp",
    "Tân Bình", "Tân Phú", "Bình Thạnh", "Phú Nhuận", "Thủ Đức",
    "Hải Châu", "Thanh Khê", "Liên Chiểu", "Ngũ Hành Sơn", "Sơn Trà",
    "Cẩm Lệ", "Hồng Bàng", "Ngô Quyền", "Lê Chân", "Hải An", "Kiến An",
    "Đồ Sơn", "Dương Kinh", "Ninh Kiều", "Bình Thủy", "Cái Răng",
    "Ô Môn", "Thốt Nốt",
]

VIETNAM_WARDS = [
    "Tràng Tiền", "Hàng Bạc", "Hàng Gai", "Hàng Trống", "Lý Thái Tổ",
    "Phúc Xá", "Trúc Bạch", "Vĩnh Phúc", "Cống Vị", "Liễu Giai",
    "Giảng Võ", "Thành Công", "Láng Hạ", "Láng Thượng", "Nhân Chính",
    "Kim Liên", "Phương Liên", "Phương Mai", "Khương Thượng", "Trung Tự",
    "Bến Nghé", "Bến Thành", "Cô Giang", "Cầu Kho", "Đa Kao", "Tân Định",
]

DEPARTMENTS = [
    {"ma": "CNTT", "ten": "Khoa Công nghệ thông tin", "cap": 1, "parent": None},
    {"ma": "DTVT", "ten": "Khoa Điện tử viễn thông", "cap": 1, "parent": None},
    {"ma": "CK", "ten": "Khoa Cơ khí", "cap": 1, "parent": None},
    {"ma": "KT", "ten": "Khoa Kinh tế", "cap": 1, "parent": None},
    {"ma": "NN", "ten": "Khoa Ngoại ngữ", "cap": 1, "parent": None},
    {"ma": "QS", "ten": "Khoa Quân sự", "cap": 1, "parent": None},
    {"ma": "P2", "ten": "Phòng Đào tạo", "cap": 1, "parent": None},
    {"ma": "P7", "ten": "Phòng Sau đại học", "cap": 1, "parent": None},
    {"ma": "BKT", "ten": "Ban Khảo thí", "cap": 1, "parent": None},
    {"ma": "KHCN", "ten": "Phòng Khoa học Công nghệ", "cap": 1, "parent": None},
    {"ma": "TV", "ten": "Trung tâm Thư viện", "cap": 1, "parent": None},
    {"ma": "CNTT-BM1", "ten": "Bộ môn Tin học cơ bản", "cap": 2, "parent": "CNTT"},
    {"ma": "CNTT-BM2", "ten": "Bộ môn Công nghệ phần mềm", "cap": 2, "parent": "CNTT"},
    {"ma": "DTVT-BM1", "ten": "Bộ môn Viễn thông", "cap": 2, "parent": "DTVT"},
    {"ma": "KT-BM1", "ten": "Bộ môn Kế toán", "cap": 2, "parent": "KT"},
]

MAJORS = [
    ("Công nghệ thông tin", "CNTT"),
    ("Kỹ thuật phần mềm", "KTPM"),
    ("An toàn thông tin", "ATTT"),
    ("Khoa học máy tính", "KHMT"),
    ("Hệ thống thông tin", "HTTT"),
    ("Truyền thông đa phương tiện", "TTĐPT"),
    ("Điện tử viễn thông", "ĐTVT"),
    ("Kỹ thuật cơ khí", "KTCK"),
    ("Kinh tế", "KT"),
    ("Tài chính ngân hàng", "TCNH"),
]

SUBJECTS = {
    "CNTT": [
        ("IT101", "Nhập môn Công nghệ thông tin", 3, 45),
        ("IT102", "Lập trình cơ bản", 4, 60),
        ("IT201", "Cấu trúc dữ liệu và giải thuật", 4, 60),
        ("IT202", "Cơ sở dữ liệu", 3, 45),
        ("IT203", "Mạng máy tính", 3, 45),
        ("IT301", "Phát triển ứng dụng Web", 3, 45),
        ("IT302", "Trí tuệ nhân tạo", 3, 45),
        ("IT303", "Học máy", 3, 45),
        ("IT304", "An toàn và bảo mật thông tin", 3, 45),
    ],
    "KT": [
        ("KT101", "Kinh tế vi mô", 3, 45),
        ("KT102", "Kinh tế vĩ mô", 3, 45),
        ("KT201", "Nguyên lý kế toán", 4, 60),
        ("KT202", "Tài chính doanh nghiệp", 3, 45),
        ("KT301", "Kinh tế lượng", 3, 45),
    ],
    "NN": [
        ("NN101", "Tiếng Anh cơ bản", 4, 60),
        ("NN102", "Tiếng Anh học thuật", 3, 45),
        ("NN201", "Tiếng Anh chuyên ngành", 3, 45),
        ("NN202", "Tiếng Trung cơ bản", 4, 60),
    ],
    "QS": [
        ("QS101", "Giáo dục Quốc phòng", 2, 30),
        ("QS102", "Điều lệnh Quân đội", 2, 30),
        ("QS201", "Chiến thuật bộ binh", 3, 45),
        ("QS202", "Kỹ thuật quân sự", 3, 45),
    ],
}

CLASS_NAMES = [f"K{year}{suffix}" for year in range(63, 68) for suffix in ["A", "B", "C"]]
STATUSES = ["dang_hoc", "tot_nghiep", "thoi_hoc"]  # keep compatible with schema CHECK
RANKINGS = ["Xuất sắc", "Giỏi", "Khá", "Trung bình", "Yếu"]

QUESTION_TYPES = ["single_choice", "multiple_choice", "true_false", "essay", "fill_blank"]
DIFFICULTIES = ["easy", "medium", "hard"]
SURVEY_TYPES = ["course_feedback", "lecturer_feedback", "service_feedback", "general"]
SURVEY_QUESTION_TYPES = ["rating", "single_choice", "multiple_choice", "text"]

TOPIC_NAMES = [
    "Khảo sát chất lượng giảng dạy",
    "Khảo sát học phần cuối kỳ",
    "Khảo sát dịch vụ đào tạo",
    "Khảo sát cơ sở vật chất",
    "Khảo sát hoạt động khảo thí",
    "Khảo sát cố vấn học tập",
    "Khảo sát trải nghiệm sinh viên",
    "Khảo sát chương trình đào tạo",
]

GROUP_NAMES = [
    "Nội dung học phần",
    "Phương pháp giảng dạy",
    "Tài liệu học tập",
    "Cơ sở vật chất",
    "Tổ chức thi",
    "Thái độ phục vụ",
    "Mức độ hài lòng chung",
    "Đánh giá giảng viên",
    "Đánh giá đề thi",
    "Góp ý cải tiến",
]

QUESTION_STEMS = [
    "Mức độ phù hợp của nội dung học phần với mục tiêu đào tạo?",
    "Giảng viên trình bày bài học rõ ràng và dễ hiểu?",
    "Tài liệu học tập được cung cấp đầy đủ?",
    "Hình thức kiểm tra đánh giá phản ánh đúng năng lực người học?",
    "Phòng học và thiết bị hỗ trợ học tập đáp ứng nhu cầu?",
    "Lịch thi được thông báo kịp thời và rõ ràng?",
    "Đề thi có độ khó phù hợp với nội dung đã học?",
    "Quy trình coi thi được tổ chức nghiêm túc?",
    "Bạn hài lòng với trải nghiệm học tập của học phần này?",
    "Bạn có góp ý gì để cải thiện học phần/dịch vụ?",
]

# ============================================
# HELPERS
# ============================================

def generate_id(prefix: str, index: int) -> str:
    return f"{prefix}{index:03d}"

def random_vietnamese_name() -> str:
    first_name = random.choice(FIRST_NAMES)
    middle_name = random.choice(MIDDLE_NAMES)
    last_name = random.choice(LAST_NAMES)
    full_name = f"{first_name} {middle_name} {last_name}"
    return full_name.strip()

def reliable_vietnamese_address():
    ward = random.choice(VIETNAM_WARDS)
    district = random.choice(VIETNAM_DISTRICTS)
    city = random.choice(VIETNAM_CITIES)
    street_number = random.randint(1, 999)
    street_name = f"Đường {random.choice(['Nguyễn Trãi', 'Lê Lợi', 'Trần Hưng Đạo', 'Lê Duẩn', 'Phạm Văn Đồng', 'Nguyễn Văn Linh', 'Võ Nguyên Giáp', 'Trường Chinh', 'Hoàng Quốc Việt'])}"
    return city, f"{street_number} {street_name}, {ward}, {district}, {city}"


def random_email(name=None):
    domains = ["gmail.com", "tlu.edu.vn", "yahoo.com", "viettel.com.vn", "fpt.vn"]
    if name:
        try:
            from unidecode import unidecode
            name_ascii = unidecode(name.lower().replace(" ", ""))
        except ImportError:
            name_ascii = name.lower().replace(" ", "")
        return f"{name_ascii}@{random.choice(domains)}"
    return fake.email()


def random_date(start_year=1990, end_year=2005):
    return fake.date_between(
        start_date=datetime(start_year, 1, 1),
        end_date=datetime(end_year, 12, 31),
    )


def random_grade(min_val=0, max_val=10, decimals=2):
    return round(random.uniform(min_val, max_val), decimals)


def random_gpa_he4():
    value = random.gauss(2.8, 0.8)
    value = min(max(value, 0.0), 4.0)
    return round(value, 2)


def sample_score_from_gpa(gpa_he4, min_val=0.0, max_val=10.0):
    """Generate a realistic score distribution based on GPA."""
    mean = 4.0 + gpa_he4 * 1.5
    stddev = 0.8 if gpa_he4 >= 2.0 else 1.0
    score = random.gauss(mean, stddev)
    score = min(max(score, min_val), max_val)
    score = round(score * 4) / 4.0

    if score < 1.0:
        score = 0.0 if random.random() < 0.1 else 1.0

    return max(min(score, max_val), min_val)


def grade_to_letter(score):
    if score >= 9.0:
        return "A+"
    if score >= 8.5:
        return "A"
    if score >= 8.0:
        return "B+"
    if score >= 7.0:
        return "B"
    if score >= 6.0:
        return "C+"
    if score >= 5.5:
        return "C"
    if score >= 5.0:
        return "D+"
    if score >= 4.0:
        return "D"
    return "F"


def score_to_grade_4(score):
    if score >= 8.5:
        return 4.0
    if score >= 8.0:
        return 3.5
    if score >= 7.0:
        return 3.0
    if score >= 6.0:
        return 2.5
    if score >= 5.5:
        return 2.0
    if score >= 5.0:
        return 1.5
    if score >= 4.0:
        return 1.0
    return 0.0


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"


def write_insert_statement(file, table, columns, rows, batch_size=500):
    if not rows:
        return

    for batch_start in range(0, len(rows), batch_size):
        batch = rows[batch_start:batch_start + batch_size]
        file.write(f"INSERT INTO {table} ({', '.join(columns)}) VALUES\n")
        values = []
        for row in batch:
            if isinstance(row, dict):
                row_values = [row[col] for col in columns]
            else:
                row_values = row
            values.append("    (" + ", ".join(sql_value(v) for v in row_values) + ")")
        file.write(",\n".join(values))
        file.write(";\n\n")


def validate_diem_uniqueness(diem_list):
    seen = set()
    for row in diem_list:
        key = (row["hoc_vien_id"], row["mon_hoc_id"], row["hoc_ky_id"])
        if key in seen:
            raise ValueError(f"Duplicate diem entry for hoc_vien_id={key[0]}, mon_hoc_id={key[1]}, hoc_ky_id={key[2]}")
        seen.add(key)


def validate_ket_qua_uniqueness(ket_qua_list):
    seen = set()
    for row in ket_qua_list:
        key = (row["hoc_vien_id"], row["hoc_ky_id"])
        if key in seen:
            raise ValueError(f"Duplicate ket_qua_hoc_ky entry for hoc_vien_id={key[0]}, hoc_ky_id={key[1]}")
        seen.add(key)


def validate_student_class_section_consistency(diem_list):
    section_map = {}
    for row in diem_list:
        key = (row["hoc_vien_id"], row["mon_hoc_id"])
        sections = section_map.setdefault(key, set())
        sections.add(row["lop_hoc_phan_id"])
        if len(sections) > 1:
            raise ValueError(
                f"Invalid class assignment: hoc_vien_id={key[0]} is enrolled in multiple lop_hoc_phan for mon_hoc_id={key[1]}"
            )


# ============================================
# TRAINING DATA GENERATION
# ============================================

def generate_nam_hoc():
    years = []
    start_year = 2021
    for i in range(NUM_NAM_HOC):
        year_start = start_year + i
        year_end = year_start + 1
        years.append({
            "id": generate_id("NH", i + 1),
            "ma": f"NH{year_start}-{year_end}",
            "ten": f"Năm học {year_start}-{year_end}",
            "ngay_bat_dau": f"{year_start}-09-01",
            "ngay_ket_thuc": f"{year_end}-08-31",
            "active": True,
        })
    return years


def generate_hoc_ky(nam_hoc_list):
    hoc_ky_list = []
    idx = 1
    for nam_hoc in nam_hoc_list:
        year_start = int(nam_hoc["ma"].split("-")[0][2:])
        specs = [
            ("HK1", "Học kỳ 1", f"{year_start}-09-01", f"{year_start + 1}-01-15"),
            ("HK2", "Học kỳ 2", f"{year_start + 1}-02-01", f"{year_start + 1}-06-30"),
            ("HK3", "Học kỳ hè", f"{year_start + 1}-07-01", f"{year_start + 1}-08-31"),
        ]
        for type_code, name_prefix, start_date, end_date in specs:
            hoc_ky_list.append({
                "id": generate_id("HK", idx),
                "ma": f"{type_code}{nam_hoc['ma'][2:]}",
                "ten": f"{name_prefix} {nam_hoc['ten']}",
                "loai_hoc_ky": type_code,
                "nam_hoc_id": nam_hoc["id"],
                "ten_nam_hoc": nam_hoc["ten"],
                "ngay_bat_dau": start_date,
                "ngay_ket_thuc": end_date,
                "active": True,
            })
            idx += 1
    return hoc_ky_list


def generate_don_vi():
    result = []
    dept_ids = {}
    for idx, dept in enumerate(DEPARTMENTS, start=1):
        don_vi_id = generate_id("DV", idx)
        dept_ids[dept["ma"]] = don_vi_id
        result.append({
            "id": don_vi_id,
            "ma": dept["ma"],
            "ten": dept["ten"],
            "ten_viet_tat": dept["ma"],
            "cap_don_vi": dept["cap"],
            "parent_id": dept_ids.get(dept["parent"]) if dept["parent"] else None,
            "active": True,
        })
    return result


def generate_giang_vien(don_vi_list):
    result = []
    degrees = ["ThS", "TS", "PGS", "GS", "ThS.", "TS.", "PGS.TS", "GS.TS"]
    academic_ranks = ["Giảng viên", "Giảng viên chính", "Giảng viên cao cấp", "Nghiên cứu viên"]
    teaching_depts = [d for d in don_vi_list if d["cap_don_vi"] == 2]

    for i in range(NUM_GIANG_VIEN):
        dept = random.choice(teaching_depts)
        name = random_vietnamese_name()
        result.append({
            "id": generate_id("GV", i + 1),
            "ma_gv": f"GV{random.randint(1000, 9999)}",
            "ho_ten": name,
            "email": random_email(name),
            "so_dien_thoai": fake.phone_number(),
            "don_vi_id": dept["id"],
            "ten_don_vi": dept["ten"],
            "hoc_vi": random.choice(degrees),
            "hoc_ham": random.choice(academic_ranks),
            "active": True,
        })
    return result


def generate_hoc_vien():
    result = []
    for i in range(NUM_HOC_VIEN):
        name = random_vietnamese_name()
        course = random.randint(63, 67)
        major_name, major_code = random.choice(MAJORS)
        gpa_he4 = random_gpa_he4()
        gpa_he10 = round(gpa_he4 * 2.5, 1)
        status = random.choice(STATUSES)
        if gpa_he4 < 1.5 and random.random() < 0.35:
            status = "thoi_hoc"

        city, address = reliable_vietnamese_address()
        result.append({
            "id": generate_id("HV", i + 1),
            "ma_hv": f"{course}{random.randint(1000, 9999)}",
            "ho_ten": name,
            "ngay_sinh": random_date(1995, 2005),
            "noi_sinh": city,
            "que_quan": address,
            "email": random_email(name),
            "so_dien_thoai": fake.phone_number(),
            "ma_lop": random.choice(CLASS_NAMES),
            "ten_chuyen_nganh": major_code,
            "ten_nganh": major_code,
            "ten_khoa_dao_tao": f"K{course}",
            "trang_thai": status,
            "gpa_he4": gpa_he4,
            "gpa_he10": gpa_he10,
            "so_tin_chi_tich_luy": random.randint(30, 150),
            "muc_canh_bao": random.randint(0, 3) if gpa_he4 < 1.5 else 0,
            "active": status != "thoi_hoc",
        })
    return result


def generate_mon_hoc(don_vi_list):
    result = []
    idx = 1
    for dept_code, subjects in SUBJECTS.items():
        dept = next((d for d in don_vi_list if d["ma"] == dept_code and d["cap_don_vi"] == 1), None)
        if not dept:
            continue
        for ma_mon, ten_mon, so_tin_chi, so_tiet in subjects:
            result.append({
                "id": generate_id("MH", idx),
                "ma_mon": ma_mon,
                "ten_mon": ten_mon,
                "so_tin_chi": so_tin_chi,
                "so_tiet": so_tiet,
                "don_vi_ql_id": dept["id"],
                "ten_don_vi_ql": dept["ten"],
                "active": True,
            })
            idx += 1

    teaching_depts = [d for d in don_vi_list if d["cap_don_vi"] == 2]
    while len(result) < NUM_MON_HOC:
        dept = random.choice(teaching_depts)
        result.append({
            "id": generate_id("MH", idx),
            "ma_mon": f"{random.choice(['CS', 'MATH', 'PHY', 'CHEM'])}{random.randint(100, 999)}",
            "ten_mon": fake.catch_phrase(),
            "so_tin_chi": random.randint(2, 4),
            "so_tiet": random.randint(30, 60),
            "don_vi_ql_id": dept["id"],
            "ten_don_vi_ql": dept["ten"],
            "active": True,
        })
        idx += 1
    return result


def generate_lop_hoc_phan(mon_hoc_list, hoc_ky_list, giang_vien_list):
    result = []
    for i in range(NUM_LOP_HOC_PHAN):
        mon_hoc = random.choice(mon_hoc_list)
        hoc_ky = random.choice(hoc_ky_list)
        giang_vien = random.choice(giang_vien_list)
        result.append({
            "id": generate_id("LHP", i + 1),
            "ma_lhp": f"{mon_hoc['ma_mon']}_{hoc_ky['ma']}_{i + 1}",
            "ten_lhp": f"{mon_hoc['ten_mon']} - {hoc_ky['ten']} - Lớp {i + 1}",
            "mon_hoc_id": mon_hoc["id"],
            "ma_mon": mon_hoc["ma_mon"],
            "ten_mon": mon_hoc["ten_mon"],
            "hoc_ky_id": hoc_ky["id"],
            "ten_hoc_ky": hoc_ky["ten"],
            "giang_vien_id": giang_vien["id"],
            "ten_giang_vien": giang_vien["ho_ten"],
            "si_so_toi_da": random.randint(30, 80),
            "phong": f"P{random.randint(100, 500)}",
            "active": True,
        })
    return result


def generate_diem(hoc_vien_list, mon_hoc_list, hoc_ky_list, lop_hoc_phan_list):
    result = []
    used_combos = set()
    student_subjects = {hv["id"]: set() for hv in hoc_vien_list}

    by_subject_semester = {}
    for lop in lop_hoc_phan_list:
        key = (lop["mon_hoc_id"], lop["hoc_ky_id"])
        by_subject_semester.setdefault(key, []).append(lop)

    available_combos = [
        (hv["id"], mon["id"], hk["id"], mon["ma_mon"], mon["ten_mon"], mon["so_tin_chi"])
        for hv in hoc_vien_list
        for mon in mon_hoc_list
        for hk in hoc_ky_list
        if (mon["id"], hk["id"]) in by_subject_semester
    ]
    random.shuffle(available_combos)

    for i, (hoc_vien_id, mon_hoc_id, hoc_ky_id, ma_mon, ten_mon, so_tin_chi) in enumerate(available_combos):
        if len(result) >= NUM_DIEM:
            break
        if mon_hoc_id in student_subjects[hoc_vien_id]:
            continue

        lop_hoc_phan_options = by_subject_semester.get((mon_hoc_id, hoc_ky_id))
        if not lop_hoc_phan_options:
            continue

        hoc_vien = next(hv for hv in hoc_vien_list if hv["id"] == hoc_vien_id)
        hoc_ky = next(hk for hk in hoc_ky_list if hk["id"] == hoc_ky_id)
        lop_hoc_phan = random.choice(lop_hoc_phan_options)

        student_subjects[hoc_vien_id].add(mon_hoc_id)
        used_combos.add((hoc_vien_id, mon_hoc_id, hoc_ky_id))

        diem_chuyen_can = sample_score_from_gpa(hoc_vien["gpa_he4"], min_val=4.0, max_val=10.0)
        diem_thuong_xuyen = sample_score_from_gpa(hoc_vien["gpa_he4"], min_val=3.5, max_val=10.0)
        diem_thi = sample_score_from_gpa(hoc_vien["gpa_he4"], min_val=2.5, max_val=10.0)
        diem_tong_ket = round(diem_chuyen_can * 0.1 + diem_thuong_xuyen * 0.2 + diem_thi * 0.7, 2)

        result.append({
            "id": len(result) + 1,
            "hoc_vien_id": hoc_vien_id,
            "ma_hv": hoc_vien["ma_hv"],
            "ho_ten_hv": hoc_vien["ho_ten"],
            "mon_hoc_id": mon_hoc_id,
            "ma_mon": ma_mon,
            "ten_mon": ten_mon,
            "so_tin_chi": so_tin_chi,
            "hoc_ky_id": hoc_ky_id,
            "ten_hoc_ky": hoc_ky["ten"],
            "lop_hoc_phan_id": lop_hoc_phan["id"],
            "diem_chuyen_can": diem_chuyen_can,
            "diem_thuong_xuyen": diem_thuong_xuyen,
            "diem_thi": diem_thi,
            "diem_tong_ket": diem_tong_ket,
            "diem_chu": grade_to_letter(diem_tong_ket),
            "diem_he4": score_to_grade_4(diem_tong_ket),
            "dat": diem_tong_ket >= 5.0,
        })

    return result


def generate_ket_qua_hoc_ky(hoc_vien_list, hoc_ky_list):
    result = []
    used_semesters = {hv["id"]: set() for hv in hoc_vien_list}

    combos = [
        (hv["id"], hk["id"], hk["ten"], hv["ma_hv"], hv["ho_ten"], hv["gpa_he4"], hv["so_tin_chi_tich_luy"])
        for hv in hoc_vien_list
        for hk in hoc_ky_list
    ]
    random.shuffle(combos)

    for i, (hoc_vien_id, hoc_ky_id, ten_hoc_ky, ma_hv, ho_ten_hv, gpa_he4, so_tin_chi_tich_luy) in enumerate(combos):
        if len(result) >= NUM_KET_QUA_HOC_KY:
            break
        if hoc_ky_id in used_semesters[hoc_vien_id]:
            continue

        used_semesters[hoc_vien_id].add(hoc_ky_id)
        gpa_hoc_ky_he4 = random_gpa_he4()
        if gpa_hoc_ky_he4 >= 3.6:
            ranking = "Xuất sắc"
        elif gpa_hoc_ky_he4 >= 3.2:
            ranking = "Giỏi"
        elif gpa_hoc_ky_he4 >= 2.5:
            ranking = "Khá"
        elif gpa_hoc_ky_he4 >= 2.0:
            ranking = "Trung bình"
        else:
            ranking = "Yếu"

        so_tc_dang_ky = random.randint(10, 25)
        so_tc_dat = random.randint(0, so_tc_dang_ky)
        result.append({
            "id": generate_id("KQ", len(result) + 1),
            "hoc_vien_id": hoc_vien_id,
            "ma_hv": ma_hv,
            "ho_ten_hv": ho_ten_hv,
            "hoc_ky_id": hoc_ky_id,
            "ten_hoc_ky": ten_hoc_ky,
            "gpa_hoc_ky_he4": gpa_hoc_ky_he4,
            "gpa_tich_luy_he4": gpa_he4,
            "gpa_hoc_ky_he10": round(gpa_hoc_ky_he4 * 2.5, 1),
            "so_tc_dang_ky": so_tc_dang_ky,
            "so_tc_dat": so_tc_dat,
            "so_tc_tich_luy": so_tin_chi_tich_luy,
            "xep_loai": ranking,
            "diem_ren_luyen": random.randint(50, 100),
            "muc_canh_bao": random.randint(0, 3),
        })
    return result


# ============================================
# KHAO THI DATA GENERATION
# ============================================

def generate_khao_thi_data(mon_hoc_list, hoc_ky_list, lop_hoc_phan_list, hoc_vien_list):
    now = datetime(2026, 6, 12, 15, 45, 0)

    subject_ids = [m["id"] for m in mon_hoc_list]
    class_section_ids = [l["id"] for l in lop_hoc_phan_list]
    semester_ids = [h["id"] for h in hoc_ky_list]
    student_ids = [h["id"] for h in hoc_vien_list]

    frameworks = []
    for i in range(1, NUM_FRAMEWORKS + 1):
        sid = random.choice(subject_ids)
        frameworks.append((f"EF{i:03d}", f"KD{i:03d}", f"Khung đề {sid} số {i}", f"Khung đề kiểm tra cho môn {sid}", random.choice([45, 60, 75, 90, 120]), sid, True, now, now, None))

    matrices = []
    for i in range(1, NUM_MATRICES + 1):
        matrices.append((f"EM{i:03d}", f"MT{i:03d}", f"Ma trận đề {i}", "Phân bổ câu hỏi theo khối kiến thức và mức độ khó", i <= 5, random.choice(frameworks)[0], True, now, now, None))

    blocks = []
    for i in range(1, NUM_KNOWLEDGE_BLOCKS + 1):
        sid = random.choice(subject_ids)
        blocks.append((f"KB{i:03d}", f"KKT{i:03d}", f"Chương {random.randint(1, 8)} - {fake.word().title()}", "Khối kiến thức phục vụ sinh câu hỏi", sid, True, now, now, None))

    banks = []
    for i in range(1, NUM_QUESTION_BANKS + 1):
        sid = random.choice(subject_ids)
        banks.append((f"QB{i:03d}", f"NHCH{i:03d}", f"Ngân hàng câu hỏi {sid}", f"Câu hỏi dùng cho kiểm tra/thi môn {sid}", sid, True, now, now, None))

    questions = []
    options = []
    for i in range(1, NUM_QUESTIONS + 1):
        qtype = random.choice(QUESTION_TYPES)
        qid = f"Q{i:04d}"
        questions.append((qid, f"CH{i:04d}", f"{random.choice(QUESTION_STEMS)} ({fake.sentence(nb_words=6)})", qtype, random.choice(DIFFICULTIES), "Đáp án dựa trên chuẩn đầu ra của học phần.", random.choice(banks)[0], random.choice(blocks)[0], True, now, now, None))
        if qtype in ["single_choice", "multiple_choice", "true_false"]:
            labels = ["A", "B"] if qtype == "true_false" else ["A", "B", "C", "D"]
            correct = random.choice(labels)
            for label in labels:
                content = "Đúng" if (qtype == "true_false" and label == "A") else fake.sentence(nb_words=8)
                options.append((f"QO{i:04d}{label}", qid, label, content, label == correct, now))

    exams = []
    exam_questions = []
    for i in range(1, NUM_EXAM_BANKS + 1):
        eid = f"EB{i:03d}"
        exams.append((eid, f"DT{i:03d}", f"M{i:03d}", "Đề thi sinh tự động từ ngân hàng câu hỏi", random.choice([45, 60, 90, 120]), "Sinh viên đọc kỹ đề trước khi làm bài", now + timedelta(days=random.randint(1, 120)), random.choice([True, False]), random.choice(semester_ids), random.choice(class_section_ids), random.choice(matrices)[0], True, now, now, None))
        sample_size = min(20, len(questions))
        for order, q in enumerate(random.sample(questions, sample_size), start=1):
            exam_questions.append((eid, q[0], order, round(random.choice([0.25, 0.5, 1.0]), 2)))

    survey_topics = []
    for i in range(1, NUM_SURVEY_TOPICS + 1):
        survey_topics.append((f"ST{i:03d}", f"CDKS{i:03d}", TOPIC_NAMES[i - 1], SURVEY_TYPES[(i - 1) % len(SURVEY_TYPES)], "Chủ đề khảo sát phục vụ cải tiến chất lượng", True, now, now, None))

    object_types = [
        ("SOT001", "HV", "Học viên", "Đối tượng khảo sát là học viên/sinh viên", "student", True, now, now, None),
        ("SOT002", "GV", "Giảng viên", "Đối tượng khảo sát là giảng viên", "lecturer", True, now, now, None),
        ("SOT003", "CBQL", "Cán bộ quản lý", "Đối tượng khảo sát là cán bộ quản lý", "staff", True, now, now, None),
    ]

    clusters = []
    for i in range(1, NUM_CLUSTER_SURVEYS + 1):
        clusters.append((f"CS{i:03d}", f"CUMKS{i:03d}", f"Cụm khảo sát {i}", "Nhóm đối tượng khảo sát theo chủ đề", random.choice(survey_topics)[0], True, now, now, None))

    groups = []
    for i in range(1, NUM_SURVEY_GROUPS + 1):
        groups.append((f"SQG{i:03d}", f"NCH{i:03d}", GROUP_NAMES[i - 1], "Nhóm câu hỏi dùng trong phiếu khảo sát", True, now, now, None))

    survey_questions = []
    for i in range(1, NUM_SURVEY_QUESTIONS + 1):
        survey_questions.append((f"SQ{i:03d}", f"CHKS{i:03d}", random.choice(QUESTION_STEMS), random.choice(SURVEY_QUESTION_TYPES), "Câu hỏi khảo sát định kỳ", random.choice(groups)[0], True, now, now, None))

    surveys = []
    for i in range(1, NUM_SURVEYS + 1):
        start = now + timedelta(days=random.randint(-60, 30))
        end = start + timedelta(days=random.randint(10, 45))
        surveys.append((f"SV{i:03d}", f"KS{i:03d}", f"Khảo sát học kỳ {random.choice(['1', '2', 'hè'])} - {i}", "Đợt khảo sát lấy ý kiến người học", start, end, random.choice([True, False]), random.choice([True, False]), random.choice(survey_topics)[0], random.choice(clusters)[0], random.choice(object_types)[0], True, now, now, None))

    sessions = []
    answers = []
    answer_id = 1
    for i in range(1, NUM_SURVEY_SESSIONS + 1):
        sid = f"SS{i:04d}"
        completed = random.random() < 0.8
        student_id = random.choice(student_ids)
        sessions.append((sid, f"PHKS{i:04d}", random.choice(surveys)[0], None, student_id, "SOT001", completed, now if completed else None, "Phiên làm khảo sát", True, now, now, None))
        for q in random.sample(survey_questions, random.randint(8, 15)):
            qtype = q[3]
            rating = random.randint(1, 5) if qtype == "rating" else None
            choice = random.choice(["A", "B", "C", "D"]) if qtype in ["single_choice", "multiple_choice"] else None
            text = fake.sentence(nb_words=12) if qtype == "text" else None
            answers.append((answer_id, sid, q[0], rating, choice, text, now))
            answer_id += 1

    return {
        "frameworks": frameworks,
        "matrices": matrices,
        "blocks": blocks,
        "banks": banks,
        "questions": questions,
        "options": options,
        "exams": exams,
        "exam_questions": exam_questions,
        "survey_topics": survey_topics,
        "object_types": object_types,
        "clusters": clusters,
        "groups": groups,
        "survey_questions": survey_questions,
        "surveys": surveys,
        "sessions": sessions,
        "answers": answers,
    }


# ============================================
# MAIN
# ============================================

def write_header(f):
    f.write("-- ============================================\n")
    f.write("-- SEED DATA FOR PM2 POSTGRESQL DATABASE\n")
    f.write("-- Includes Training Module + Khao Thi Module\n")
    f.write("-- Generated by generate_seed.py using Faker vi_VN\n")
    f.write(f"-- Generated at: {datetime.now()}\n")
    f.write("-- ============================================\n\n")
    f.write("SET session_replication_role = 'replica';\n\n")


def write_footer(f):
    f.write("SET session_replication_role = 'origin';\n")
    f.write("ANALYZE;\n")


def main():
    parser = argparse.ArgumentParser(description="Generate complete seed data for PostgreSQL")
    parser.add_argument("--output", "-o", default="infra/postgres/init/02-seed.sql", help="Output SQL file")
    parser.add_argument("--truncate", "-t", action="store_true", help="Include TRUNCATE statements")
    args = parser.parse_args()

    with open(args.output, "w", encoding="utf-8") as f:
        write_header(f)

        if args.truncate:
            f.write("""-- Clearing existing data
TRUNCATE TABLE
    survey_answers, survey_sessions, surveys, survey_questions, survey_question_groups,
    cluster_surveys, survey_object_types, survey_topics,
    exam_bank_questions, exam_banks, question_options, questions, question_banks,
    knowledge_blocks, exam_matrices, exam_frameworks,
    diem, ket_qua_hoc_ky, lop_hoc_phan, mon_hoc,
    hoc_vien, giang_vien, don_vi, hoc_ky, nam_hoc
RESTART IDENTITY CASCADE;

""")

        f.write("-- ============================================\n-- DIMENSION TABLES\n-- ============================================\n\n")
        nam_hoc_list = generate_nam_hoc()
        hoc_ky_list = generate_hoc_ky(nam_hoc_list)
        don_vi_list = generate_don_vi()
        giang_vien_list = generate_giang_vien(don_vi_list)

        write_insert_statement(f, "nam_hoc", ["id", "ma", "ten", "ngay_bat_dau", "ngay_ket_thuc", "active"], nam_hoc_list)
        write_insert_statement(f, "hoc_ky", ["id", "ma", "ten", "loai_hoc_ky", "nam_hoc_id", "ten_nam_hoc", "ngay_bat_dau", "ngay_ket_thuc", "active"], hoc_ky_list)
        write_insert_statement(f, "don_vi", ["id", "ma", "ten", "ten_viet_tat", "cap_don_vi", "parent_id", "active"], don_vi_list)
        write_insert_statement(f, "giang_vien", ["id", "ma_gv", "ho_ten", "email", "so_dien_thoai", "don_vi_id", "ten_don_vi", "hoc_vi", "hoc_ham", "active"], giang_vien_list)

        f.write("-- ============================================\n-- MAIN ENTITY TABLES\n-- ============================================\n\n")
        hoc_vien_list = generate_hoc_vien()
        mon_hoc_list = generate_mon_hoc(don_vi_list)
        lop_hoc_phan_list = generate_lop_hoc_phan(mon_hoc_list, hoc_ky_list, giang_vien_list)

        write_insert_statement(f, "hoc_vien", ["id", "ma_hv", "ho_ten", "ngay_sinh", "noi_sinh", "que_quan", "email", "so_dien_thoai", "ma_lop", "ten_chuyen_nganh", "ten_nganh", "ten_khoa_dao_tao", "trang_thai", "gpa_he4", "gpa_he10", "so_tin_chi_tich_luy", "muc_canh_bao", "active"], hoc_vien_list)
        write_insert_statement(f, "mon_hoc", ["id", "ma_mon", "ten_mon", "so_tin_chi", "so_tiet", "don_vi_ql_id", "ten_don_vi_ql", "active"], mon_hoc_list)
        write_insert_statement(f, "lop_hoc_phan", ["id", "ma_lhp", "ten_lhp", "mon_hoc_id", "ma_mon", "ten_mon", "hoc_ky_id", "ten_hoc_ky", "giang_vien_id", "ten_giang_vien", "si_so_toi_da", "phong", "active"], lop_hoc_phan_list)

        f.write("-- ============================================\n-- FACT TABLES\n-- ============================================\n\n")
        diem_list = generate_diem(hoc_vien_list, mon_hoc_list, hoc_ky_list, lop_hoc_phan_list)
        validate_diem_uniqueness(diem_list)
        validate_student_class_section_consistency(diem_list)
        ket_qua_list = generate_ket_qua_hoc_ky(hoc_vien_list, hoc_ky_list)
        validate_ket_qua_uniqueness(ket_qua_list)

        write_insert_statement(f, "diem", ["id", "hoc_vien_id", "ma_hv", "ho_ten_hv", "mon_hoc_id", "ma_mon", "ten_mon", "so_tin_chi", "hoc_ky_id", "ten_hoc_ky", "lop_hoc_phan_id", "diem_chuyen_can", "diem_thuong_xuyen", "diem_thi", "diem_tong_ket", "diem_chu", "diem_he4", "dat"], diem_list)
        write_insert_statement(f, "ket_qua_hoc_ky", ["id", "hoc_vien_id", "ma_hv", "ho_ten_hv", "hoc_ky_id", "ten_hoc_ky", "gpa_hoc_ky_he4", "gpa_tich_luy_he4", "gpa_hoc_ky_he10", "so_tc_dang_ky", "so_tc_dat", "so_tc_tich_luy", "xep_loai", "diem_ren_luyen", "muc_canh_bao"], ket_qua_list)

        f.write("-- ============================================\n-- KHAO THI TABLES\n-- ============================================\n\n")
        khao_thi = generate_khao_thi_data(mon_hoc_list, hoc_ky_list, lop_hoc_phan_list, hoc_vien_list)

        write_insert_statement(f, "exam_frameworks", ["id", "code", "name", "description", "time_minutes", "mon_hoc_id", "active", "created_at", "updated_at", "created_by"], khao_thi["frameworks"])
        write_insert_statement(f, "exam_matrices", ["id", "code", "name", "description", "is_default", "exam_framework_id", "active", "created_at", "updated_at", "created_by"], khao_thi["matrices"])
        write_insert_statement(f, "knowledge_blocks", ["id", "code", "name", "description", "mon_hoc_id", "active", "created_at", "updated_at", "created_by"], khao_thi["blocks"])
        write_insert_statement(f, "question_banks", ["id", "code", "name", "description", "mon_hoc_id", "active", "created_at", "updated_at", "created_by"], khao_thi["banks"])
        write_insert_statement(f, "questions", ["id", "code", "content", "type", "difficult", "explanation", "question_bank_id", "knowledge_block_id", "active", "created_at", "updated_at", "created_by"], khao_thi["questions"])
        write_insert_statement(f, "question_options", ["id", "question_id", "option_label", "content", "is_correct", "created_at"], khao_thi["options"])
        write_insert_statement(f, "exam_banks", ["id", "code", "exam_code", "description", "exam_time", "explain", "exam_day", "is_note", "hoc_ky_id", "lop_hoc_phan_id", "exam_matrix_id", "active", "created_at", "updated_at", "created_by"], khao_thi["exams"])
        write_insert_statement(f, "exam_bank_questions", ["exam_bank_id", "question_id", "question_order", "points"], khao_thi["exam_questions"])
        write_insert_statement(f, "survey_topics", ["id", "code", "name", "type", "description", "active", "created_at", "updated_at", "created_by"], khao_thi["survey_topics"])
        write_insert_statement(f, "survey_object_types", ["id", "code", "name", "description", "training_object_type_code", "active", "created_at", "updated_at", "created_by"], khao_thi["object_types"])
        write_insert_statement(f, "cluster_surveys", ["id", "code", "name", "description", "survey_topic_id", "active", "created_at", "updated_at", "created_by"], khao_thi["clusters"])
        write_insert_statement(f, "survey_question_groups", ["id", "code", "name", "description", "active", "created_at", "updated_at", "created_by"], khao_thi["groups"])
        write_insert_statement(f, "survey_questions", ["id", "code", "name", "type", "description", "survey_question_group_id", "active", "created_at", "updated_at", "created_by"], khao_thi["survey_questions"])
        write_insert_statement(f, "surveys", ["id", "code", "name", "description", "start_date", "end_date", "is_public", "anonymous", "survey_topic_id", "cluster_survey_id", "survey_object_type_id", "active", "created_at", "updated_at", "created_by"], khao_thi["surveys"])
        write_insert_statement(f, "survey_sessions", ["id", "code", "survey_id", "user_id", "hoc_vien_id", "survey_object_type_id", "is_completed", "completed_at", "description", "active", "created_at", "updated_at", "created_by"], khao_thi["sessions"])
        write_insert_statement(f, "survey_answers", ["id", "survey_session_id", "survey_question_id", "rating_value", "choice_value", "text_value", "created_at"], khao_thi["answers"])

        write_footer(f)

    print(f"Seed data generated successfully in: {args.output}")


if __name__ == "__main__":
    main()