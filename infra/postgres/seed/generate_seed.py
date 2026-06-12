#!/usr/bin/env python3
"""
generate_seed.py - Seed data generator for PostgreSQL using Faker vi_VN with reliable Vietnamese data
Usage: python generate_seed.py --output seed_data.sql
"""

import random
from datetime import datetime, timedelta
from faker import Faker

# Initialize Faker with Vietnamese locale
fake = Faker('vi_VN')
# Also seed for reproducibility
Faker.seed(2024)
random.seed(2024)

# ============================================
# RELIABLE VIETNAMESE LOCATION DATA
# ============================================

# Vietnamese cities/provinces (thành phố/tỉnh)
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
    "Tuyên Quang", "Hà Giang", "Quảng Ninh"
]

# Vietnamese districts (huyện/quận)
VIETNAM_DISTRICTS = [
    "Ba Đình", "Hoàn Kiếm", "Hai Bà Trưng", "Đống Đa", "Cầu Giấy",
    "Thanh Xuân", "Hoàng Mai", "Long Biên", "Bắc Từ Liêm", "Nam Từ Liêm",
    "Quận 1", "Quận 2", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7",
    "Quận 8", "Quận 9", "Quận 10", "Quận 11", "Quận 12", "Gò Vấp",
    "Tân Bình", "Tân Phú", "Bình Thạnh", "Phú Nhuận", "Thủ Đức",
    "Hải Châu", "Thanh Khê", "Liên Chiểu", "Ngũ Hành Sơn", "Sơn Trà",
    "Cẩm Lệ", "Hồng Bàng", "Ngô Quyền", "Lê Chân", "Hải An", "Kiến An",
    "Đồ Sơn", "Dương Kinh", "Ninh Kiều", "Bình Thủy", "Cái Răng",
    "Ô Môn", "Thốt Nốt"
]

# Vietnamese wards/communes (phường/xã)
VIETNAM_WARDS = [
    "Tràng Tiền", "Hàng Bạc", "Hàng Gai", "Hàng Trống", "Lý Thái Tổ",
    "Phúc Xá", "Trúc Bạch", "Vĩnh Phúc", "Cống Vị", "Liễu Giai",
    "Giảng Võ", "Thành Công", "Láng Hạ", "Láng Thượng", "Nhân Chính",
    "Kim Liên", "Phương Liên", "Phương Mai", "Khương Thượng", "Trung Tự",
    "Bến Nghé", "Bến Thành", "Cô Giang", "Cầu Kho", "Đa Kao", "Tân Định"
]

def reliable_vietnamese_address():
    """Generate a reliable Vietnamese city name and address."""
    ward = random.choice(VIETNAM_WARDS)
    district = random.choice(VIETNAM_DISTRICTS)
    city = random.choice(VIETNAM_CITIES)
    street_number = random.randint(1, 999)
    street_name = f"Đường {random.choice(['Nguyễn Trãi', 'Lê Lợi', 'Trần Hưng Đạo', 'Lê Duẩn', 'Phạm Văn Đồng', 'Nguyễn Văn Linh', 'Võ Nguyên Giáp', 'Trường Chinh', 'Hoàng Quốc Việt'])}"
    return city, f"{street_number} {street_name}, {ward}, {district}, {city}"

# ============================================
# CONFIGURATION
# ============================================

NUM_NAM_HOC = 5                    # 5 academic years (2021-2026)
NUM_HOC_VIEN = 500                 # 500 students
NUM_GIANG_VIEN = 50                # 50 lecturers
NUM_DON_VI = 15                    # 15 departments
NUM_MON_HOC = 80                   # 80 subjects
NUM_LOP_HOC_PHAN = 120             # 120 class sections
NUM_DIEM = 2000                    # 2000 grade records
NUM_KET_QUA_HOC_KY = 1000          # 1000 semester results
NUM_USERS = 100                    # 100 user accounts
NUM_DOCUMENTS = 200                # 200 documents

# Vietnamese departments (realistic for Military Technical Academy)
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

# Vietnamese majors (ngành đào tạo)
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

# Vietnamese subjects by department (môn học)
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

# Vietnamese class names (K65, K66, etc.)
CLASS_NAMES = [f"K{year}{suffix}" for year in range(63, 68) for suffix in ['A', 'B', 'C']]

# Grade statuses
STATUSES = ["dang_hoc", "tot_nghiep", "thoi_hoc", "bao_luu"]
RANKINGS = ["Xuất sắc", "Giỏi", "Khá", "Trung bình", "Yếu"]


# ============================================
# HELPER FUNCTIONS
# ============================================

def generate_id(prefix, index):
    """Generate ID like PREFIX001, PREFIX002."""
    return f"{prefix}{index:03d}"

def random_vietnamese_name(gender=None):
    """Generate random Vietnamese name using Faker."""
    return fake.name()

def random_phone():
    """Generate Vietnamese phone number using Faker."""
    return fake.phone_number()

def random_email(name=None):
    """Generate Vietnamese email address."""
    domains = ["gmail.com", "tlu.edu.vn", "yahoo.com", "viettel.com.vn", "fpt.vn"]
    if name:
        from unidecode import unidecode
        name_ascii = unidecode(name.lower().replace(" ", ""))
        return f"{name_ascii}@{random.choice(domains)}"
    return fake.email()

def random_date(start_year=1990, end_year=2005):
    """Generate random date."""
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    return fake.date_between(start_date=start, end_date=end)

def random_grade(min_val=0, max_val=10, decimals=2):
    """Generate random grade."""
    return round(random.uniform(min_val, max_val), decimals)

def random_gpa_he4():
    """Generate random GPA on 4.0 scale."""
    return round(random.uniform(0, 4.0), 2)

def grade_to_letter(score):
    """Convert numeric score to letter grade."""
    if score >= 9.0:
        return "A+"
    elif score >= 8.5:
        return "A"
    elif score >= 8.0:
        return "B+"
    elif score >= 7.0:
        return "B"
    elif score >= 6.0:
        return "C+"
    elif score >= 5.5:
        return "C"
    elif score >= 5.0:
        return "D+"
    elif score >= 4.0:
        return "D"
    else:
        return "F"

def score_to_grade_4(score):
    """Convert numeric score to 4.0 scale."""
    if score >= 8.5:
        return 4.0
    elif score >= 8.0:
        return 3.5
    elif score >= 7.0:
        return 3.0
    elif score >= 6.0:
        return 2.5
    elif score >= 5.5:
        return 2.0
    elif score >= 5.0:
        return 1.5
    elif score >= 4.0:
        return 1.0
    else:
        return 0.0

def is_passing(score):
    """Check if student passes the subject."""
    return score >= 5.0


# ============================================
# DATA GENERATION FUNCTIONS
# ============================================

def generate_nam_hoc():
    """Generate academic years."""
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
    """Generate semesters based on academic years."""
    hoc_ky_list = []
    semester_types = ["HK1", "HK2", "HK3"]
    semester_names = ["Học kỳ 1", "Học kỳ 2", "Học kỳ hè"]
    
    idx = 1
    for nam_hoc in nam_hoc_list:
        year_start = int(nam_hoc["ma"].split("-")[0][2:])
        for i, (type_code, name_prefix) in enumerate(zip(semester_types, semester_names)):
            semester_name = f"{name_prefix} {nam_hoc['ten']}"
            
            if i == 0:  # HK1: Sep - Jan
                start_date = f"{year_start}-09-01"
                end_date = f"{year_start + 1}-01-15"
            elif i == 1:  # HK2: Feb - Jun
                start_date = f"{year_start + 1}-02-01"
                end_date = f"{year_start + 1}-06-30"
            else:  # HK3: Jul - Aug
                start_date = f"{year_start + 1}-07-01"
                end_date = f"{year_start + 1}-08-31"
            
            hoc_ky_list.append({
                "id": generate_id("HK", idx),
                "ma": f"{type_code}{nam_hoc['ma'][2:]}",
                "ten": semester_name,
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
    """Generate departments/units."""
    don_vi_list = []
    idx = 1
    
    # Map department codes to IDs
    dept_ids = {}
    
    # First pass: create all departments
    for dept in DEPARTMENTS:
        don_vi_id = generate_id("DV", idx)
        dept_ids[dept["ma"]] = don_vi_id
        
        parent_id = None
        if dept["parent"]:
            parent_id = dept_ids.get(dept["parent"])
        
        don_vi_list.append({
            "id": don_vi_id,
            "ma": dept["ma"],
            "ten": dept["ten"],
            "ten_viet_tat": dept["ma"],
            "cap_don_vi": dept["cap"],
            "parent_id": parent_id,
            "active": True,
        })
        idx += 1
    
    return don_vi_list


def generate_giang_vien(don_vi_list):
    """Generate lecturers with Vietnamese names."""
    giang_vien_list = []
    degrees = ["ThS", "TS", "PGS", "GS", "ThS.", "TS.", "PGS.TS", "GS.TS"]
    academic_ranks = ["Giảng viên", "Giảng viên chính", "Giảng viên cao cấp", "Nghiên cứu viên"]
    
    # Get teaching departments (cap 2)
    teaching_depts = [d for d in don_vi_list if d["cap_don_vi"] == 2]
    
    for i in range(NUM_GIANG_VIEN):
        don_vi = random.choice(teaching_depts)
        
        # Faker generates authentic Vietnamese names
        full_name = random_vietnamese_name()
        
        giang_vien_list.append({
            "id": generate_id("GV", i + 1),
            "ma_gv": f"GV{random.randint(1000, 9999)}",
            "ho_ten": full_name,
            "email": random_email(full_name),
            "so_dien_thoai": random_phone(),
            "don_vi_id": don_vi["id"],
            "ten_don_vi": don_vi["ten"],
            "hoc_vi": random.choice(degrees),
            "hoc_ham": random.choice(academic_ranks),
            "active": True,
        })
    return giang_vien_list


def generate_hoc_vien():
    """Generate students with Vietnamese names and reliable locations."""
    hoc_vien_list = []
    
    for i in range(NUM_HOC_VIEN):
        full_name = random_vietnamese_name()
        
        course = random.randint(63, 67)
        major_code, major_name = random.choice(MAJORS)
        ma_lop = random.choice(CLASS_NAMES)
        
        gpa_he4 = random_gpa_he4()
        gpa_he10 = round(gpa_he4 * 2.5, 1)
        
        if gpa_he4 < 1.5 and random.random() < 0.3:
            status = "thoi_hoc"
        elif random.random() < 0.1:
            status = "bao_luu"
        else:
            status = random.choice(STATUSES)
        
        # Use reliable Vietnamese locations instead of fake.city() and fake.address()
        city, address = reliable_vietnamese_address()
        
        hoc_vien_list.append({
            "id": generate_id("HV", i + 1),
            "ma_hv": f"{course}{random.randint(1000, 9999)}",
            "ho_ten": full_name,
            "ngay_sinh": random_date(1995, 2005),
            "noi_sinh": city,
            "que_quan": address,
            "email": random_email(full_name),
            "so_dien_thoai": random_phone(),
            "ma_lop": ma_lop,
            "ten_chuyen_nganh": major_name,
            "ten_nganh": major_name,
            "ten_khoa_dao_tao": f"K{course}",
            "trang_thai": status,
            "gpa_he4": gpa_he4,
            "gpa_he10": gpa_he10,
            "so_tin_chi_tich_luy": random.randint(30, 150),
            "muc_canh_bao": random.randint(0, 3) if gpa_he4 < 1.5 else 0,
            "active": status != "thoi_hoc",
        })
    return hoc_vien_list


def generate_mon_hoc(don_vi_list):
    """Generate subjects."""
    mon_hoc_list = []
    idx = 1
    
    for dept_name, subjects in SUBJECTS.items():
        dept = next((d for d in don_vi_list if d["ma"] == dept_name and d["cap_don_vi"] == 1), None)
        if dept:
            for ma_mon, ten_mon, so_tin_chi, so_tiet in subjects:
                mon_hoc_list.append({
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
    while len(mon_hoc_list) < NUM_MON_HOC:
        dept = random.choice(teaching_depts)
        mon_hoc_list.append({
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
    
    return mon_hoc_list


def generate_lop_hoc_phan(mon_hoc_list, hoc_ky_list, giang_vien_list):
    """Generate class sections."""
    lop_hoc_phan_list = []
    
    for i in range(NUM_LOP_HOC_PHAN):
        mon_hoc = random.choice(mon_hoc_list)
        hoc_ky = random.choice(hoc_ky_list)
        giang_vien = random.choice(giang_vien_list)
        
        lop_hoc_phan_list.append({
            "id": generate_id("LHP", i + 1),
            "ma_lhp": f"{mon_hoc['ma_mon']}_{hoc_ky['ma']}_{i+1}",
            "ten_lhp": f"{mon_hoc['ten_mon']} - {hoc_ky['ten']} - Lớp {i+1}",
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
    return lop_hoc_phan_list


def generate_diem(hoc_vien_list, mon_hoc_list, hoc_ky_list, lop_hoc_phan_list):
    """Generate grades."""
    diem_list = []
    
    for i in range(NUM_DIEM):
        hoc_vien = random.choice(hoc_vien_list)
        mon_hoc = random.choice(mon_hoc_list)
        hoc_ky = random.choice(hoc_ky_list)
        
        lop_hoc_phan = next(
            (l for l in lop_hoc_phan_list if l["mon_hoc_id"] == mon_hoc["id"] and l["hoc_ky_id"] == hoc_ky["id"]),
            random.choice(lop_hoc_phan_list)
        )
        
        gpa_factor = hoc_vien["gpa_he4"] / 4.0
        diem_chuyen_can = min(10, max(0, random_grade(5, 10) + random.uniform(-2, 2) * gpa_factor))
        diem_thuong_xuyen = min(10, max(0, random_grade(4, 10) + random.uniform(-2, 2) * gpa_factor))
        diem_thi = min(10, max(0, random_grade(3, 10) + random.uniform(-2, 2) * gpa_factor))
        
        diem_tong_ket = round(diem_chuyen_can * 0.1 + diem_thuong_xuyen * 0.2 + diem_thi * 0.7, 2)
        
        diem_list.append({
            "id": i + 1,
            "hoc_vien_id": hoc_vien["id"],
            "ma_hv": hoc_vien["ma_hv"],
            "ho_ten_hv": hoc_vien["ho_ten"],
            "mon_hoc_id": mon_hoc["id"],
            "ma_mon": mon_hoc["ma_mon"],
            "ten_mon": mon_hoc["ten_mon"],
            "so_tin_chi": mon_hoc["so_tin_chi"],
            "hoc_ky_id": hoc_ky["id"],
            "ten_hoc_ky": hoc_ky["ten"],
            "lop_hoc_phan_id": lop_hoc_phan["id"],
            "diem_chuyen_can": round(diem_chuyen_can, 2),
            "diem_thuong_xuyen": round(diem_thuong_xuyen, 2),
            "diem_thi": round(diem_thi, 2),
            "diem_tong_ket": diem_tong_ket,
            "diem_chu": grade_to_letter(diem_tong_ket),
            "diem_he4": round(score_to_grade_4(diem_tong_ket), 2),
            "dat": is_passing(diem_tong_ket),
        })
    return diem_list


def generate_ket_qua_hoc_ky(hoc_vien_list, hoc_ky_list):
    """Generate semester results."""
    ket_qua_list = []
    
    for i in range(NUM_KET_QUA_HOC_KY):
        hoc_vien = random.choice(hoc_vien_list)
        hoc_ky = random.choice(hoc_ky_list)
        
        gpa_hoc_ky_he4 = random_gpa_he4()
        
        if gpa_hoc_ky_he4 >= 3.6:
            ranking = RANKINGS[0]
        elif gpa_hoc_ky_he4 >= 3.2:
            ranking = RANKINGS[1]
        elif gpa_hoc_ky_he4 >= 2.5:
            ranking = RANKINGS[2]
        elif gpa_hoc_ky_he4 >= 2.0:
            ranking = RANKINGS[3]
        else:
            ranking = RANKINGS[4]
        
        ket_qua_list.append({
            "id": generate_id("KQ", i + 1),
            "hoc_vien_id": hoc_vien["id"],
            "ma_hv": hoc_vien["ma_hv"],
            "ho_ten_hv": hoc_vien["ho_ten"],
            "hoc_ky_id": hoc_ky["id"],
            "ten_hoc_ky": hoc_ky["ten"],
            "gpa_hoc_ky_he4": gpa_hoc_ky_he4,
            "gpa_tich_luy_he4": hoc_vien["gpa_he4"],
            "gpa_hoc_ky_he10": round(gpa_hoc_ky_he4 * 2.5, 1),
            "so_tc_dang_ky": random.randint(10, 25),
            "so_tc_dat": random.randint(8, 25),
            "so_tc_tich_luy": hoc_vien["so_tin_chi_tich_luy"],
            "xep_loai": ranking,
            "diem_ren_luyen": random.randint(50, 100),
            "muc_canh_bao": random.randint(0, 3),
        })
    return ket_qua_list


# ============================================
# SQL OUTPUT GENERATION
# ============================================

def write_sql_header(file):
    """Write SQL header to file."""
    file.write("-- ============================================\n")
    file.write("-- SEED DATA FOR PM2 POSTGRESQL DATABASE\n")
    file.write("-- Generated by generate_seed.py using Faker vi_VN\n")
    file.write(f"-- Generated at: {datetime.now()}\n")
    file.write("-- ============================================\n")
    file.write("\n")
    file.write("-- Disable triggers for faster loading\n")
    file.write("SET session_replication_role = 'replica';\n")
    file.write("\n")


def write_sql_footer(file):
    """Write SQL footer to file."""
    file.write("\n")
    file.write("-- Re-enable triggers\n")
    file.write("SET session_replication_role = 'origin';\n")
    file.write("\n")
    file.write("-- Update statistics\n")
    file.write("ANALYZE;\n")


def write_insert_statement(file, table, columns, data_list, batch_size=500):
    """Write INSERT statement to file with batch processing."""
    if not data_list:
        return
    
    col_str = ", ".join(columns)
    
    for batch_start in range(0, len(data_list), batch_size):
        batch = data_list[batch_start:batch_start + batch_size]
        values_list = []
        
        for data in batch:
            values = []
            for col in columns:
                val = data[col]
                if val is None:
                    values.append("NULL")
                elif isinstance(val, bool):
                    values.append(str(val).upper())
                elif isinstance(val, (int, float)):
                    values.append(str(val))
                else:
                    escaped = str(val).replace("'", "''")
                    values.append(f"'{escaped}'")
            values_list.append(f"({', '.join(values)})")
        
        values_str = ",\n    ".join(values_list)
        file.write(f"INSERT INTO {table} ({col_str}) VALUES\n")
        file.write(f"    {values_str};\n")
        file.write("\n")


# ============================================
# MAIN FUNCTION
# ============================================

def main():
    """Main function to generate all seed data."""
    
    import argparse
    parser = argparse.ArgumentParser(description='Generate seed data for PostgreSQL')
    parser.add_argument('--output', '-o', 
                       type=str, 
                       default='infra/postgres/init/02-seed.sql',
                       help='Output SQL file')
    parser.add_argument('--truncate', '-t', 
                       action='store_true', 
                       help='Include TRUNCATE statements')
    args = parser.parse_args()
    
    # Open file with UTF-8 encoding
    with open(args.output, 'w', encoding='utf-8') as f:
        write_sql_header(f)
        
        # Optional: Truncate tables
        if args.truncate:
            f.write("-- Clearing existing data\n")
            f.write("TRUNCATE TABLE diem, ket_qua_hoc_ky, lop_hoc_phan, mon_hoc,\n")
            f.write("    hoc_vien, giang_vien, don_vi, hoc_ky, nam_hoc, users, documents CASCADE;\n")
            f.write("\n")
        
        # Generate dimension tables
        f.write("-- ============================================\n")
        f.write("-- DIMENSION TABLES\n")
        f.write("-- ============================================\n")
        f.write("\n")
        
        nam_hoc_list = generate_nam_hoc()
        write_insert_statement(f, "nam_hoc", ["id", "ma", "ten", "ngay_bat_dau", "ngay_ket_thuc", "active"], nam_hoc_list)
        
        hoc_ky_list = generate_hoc_ky(nam_hoc_list)
        write_insert_statement(f, "hoc_ky", ["id", "ma", "ten", "loai_hoc_ky", "nam_hoc_id", "ten_nam_hoc", "ngay_bat_dau", "ngay_ket_thuc", "active"], hoc_ky_list)
        
        don_vi_list = generate_don_vi()
        write_insert_statement(f, "don_vi", ["id", "ma", "ten", "ten_viet_tat", "cap_don_vi", "parent_id", "active"], don_vi_list)
        
        giang_vien_list = generate_giang_vien(don_vi_list)
        write_insert_statement(f, "giang_vien", ["id", "ma_gv", "ho_ten", "email", "so_dien_thoai", "don_vi_id", "ten_don_vi", "hoc_vi", "hoc_ham", "active"], giang_vien_list)
        
        # Generate main entity tables
        f.write("-- ============================================\n")
        f.write("-- MAIN ENTITY TABLES\n")
        f.write("-- ============================================\n")
        f.write("\n")
        
        hoc_vien_list = generate_hoc_vien()
        write_insert_statement(f, "hoc_vien", ["id", "ma_hv", "ho_ten", "ngay_sinh", "noi_sinh", "que_quan", "email", "so_dien_thoai", "ma_lop", "ten_chuyen_nganh", "ten_nganh", "ten_khoa_dao_tao", "trang_thai", "gpa_he4", "gpa_he10", "so_tin_chi_tich_luy", "muc_canh_bao", "active"], hoc_vien_list)
        
        mon_hoc_list = generate_mon_hoc(don_vi_list)
        write_insert_statement(f, "mon_hoc", ["id", "ma_mon", "ten_mon", "so_tin_chi", "so_tiet", "don_vi_ql_id", "ten_don_vi_ql", "active"], mon_hoc_list)
        
        lop_hoc_phan_list = generate_lop_hoc_phan(mon_hoc_list, hoc_ky_list, giang_vien_list)
        write_insert_statement(f, "lop_hoc_phan", ["id", "ma_lhp", "ten_lhp", "mon_hoc_id", "ma_mon", "ten_mon", "hoc_ky_id", "ten_hoc_ky", "giang_vien_id", "ten_giang_vien", "si_so_toi_da", "phong", "active"], lop_hoc_phan_list)
        
        # Generate fact tables
        f.write("-- ============================================\n")
        f.write("-- FACT TABLES\n")
        f.write("-- ============================================\n")
        f.write("\n")
        
        diem_list = generate_diem(hoc_vien_list, mon_hoc_list, hoc_ky_list, lop_hoc_phan_list)
        write_insert_statement(f, "diem", ["id", "hoc_vien_id", "ma_hv", "ho_ten_hv", "mon_hoc_id", "ma_mon", "ten_mon", "so_tin_chi", "hoc_ky_id", "ten_hoc_ky", "lop_hoc_phan_id", "diem_chuyen_can", "diem_thuong_xuyen", "diem_thi", "diem_tong_ket", "diem_chu", "diem_he4", "dat"], diem_list)
        
        ket_qua_list = generate_ket_qua_hoc_ky(hoc_vien_list, hoc_ky_list)
        write_insert_statement(f, "ket_qua_hoc_ky", ["id", "hoc_vien_id", "ma_hv", "ho_ten_hv", "hoc_ky_id", "ten_hoc_ky", "gpa_hoc_ky_he4", "gpa_tich_luy_he4", "gpa_hoc_ky_he10", "so_tc_dang_ky", "so_tc_dat", "so_tc_tich_luy", "xep_loai", "diem_ren_luyen", "muc_canh_bao"], ket_qua_list)
        
        write_sql_footer(f)
    
    print(f"Seed data generated successfully in: {args.output}")


if __name__ == "__main__":
    main()