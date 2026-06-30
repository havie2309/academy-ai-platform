# Chunk Quality Evaluation Report

## Summary

| Metric | Value |
|--------|-------|
| Total Documents | 30 |
| Documents with Errors | 10 |
| Adversarial Documents | 9 |
| Average Heading Detection | 1.0 |
| Average Child Size (chars) | 131.3 |
| Average Parent Size (chars) | 260.9 |
| Total Mid-Sentence Cuts | 17 |
| Average Mid-Sentence Cuts per Doc | 0.57 |
| Average Diacritic Density (OCR quality proxy) | 0.283 |

---

## Per-Document Results

### 1. DOC-0001.docx

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0001.docx`
- Adversarial: `False`
**Statistics:**
- Parents: 13, Children: 13
- Child size (avg/min/max): 129.0 / 27 / 180
- Parent size (avg/max): 132.5 / 184
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 361
- Diacritic density: 0.287

**Parent Chunk Samples:**

- **ID:** `parent-84e7dc63`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Biên bản họp đào tạo

Phân loại: Biên bản họp

Nguồn: Phòng Chính trị

Ngày tạo: 30/06/2026
```

- **ID:** `parent-d1e1c414`
  - **Section Path:** `# Chương 1: Học không giám sát`
  - **Child Count:** 1
  - **Text:**
```text
# Chương 1: Học không giám sát
```

- **ID:** `parent-ee2ae60f`
  - **Section Path:** `# Chương 1: Học không giám sát > ### 1.1 Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.`
  - **Child Count:** 1
  - **Text:**
```text
### 1.1 Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

**Child Chunk Samples:**

- **ID:** `child-ed608952`
  - **Parent ID:** `parent-84e7dc63`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Biên bản họp đào tạo
Phân loại: Biên bản họp
Nguồn: Phòng Chính trị
Ngày tạo: 30/06/2026
```

- **ID:** `child-af7668b4`
  - **Parent ID:** `parent-d1e1c414`
  - **Section Path:** `# Chương 1: Học không giám sát`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Học không giám sát
```

- **ID:** `child-437f398d`
  - **Parent ID:** `parent-ee2ae60f`
  - **Section Path:** `# Chương 1: Học không giám sát > ### 1.1 Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.`
  - **Index:** 0
  - **Text:**
```text
1.1 Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

- **ID:** `child-00bb4255`
  - **Parent ID:** `parent-45ecba92`
  - **Section Path:** `# Chương 1: Học không giám sát > ### 1.2 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.`
  - **Index:** 0
  - **Text:**
```text
1.2 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

- **ID:** `child-5e4162df`
  - **Parent ID:** `parent-dfb1e855`
  - **Section Path:** `# Chương 1: Học không giám sát > ### 1.3 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.`
  - **Index:** 0
  - **Text:**
```text
1.3 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

---

### 2. DOC-0002.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0002.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 1, Children: 14
- Child size (avg/min/max): 189.3 / 20 / 237
- Parent size (avg/max): 1003.0 / 1003
- Heading detection ratio: 1.0
- Section path present (parents): False
- Section path present (children): False
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 457
- Diacritic density: 0.270

**Parent Chunk Samples:**

- **ID:** `parent-37df42d6`
  - **Section Path:** ``
  - **Child Count:** 14
  - **Text:**
```text
Giải pháp tối ưu cho đào tạo trực tuyến
Mô hình học tập thích ứng trong giáo dục quân sự
TÓM TẮT
Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Phương
pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao. Việc tích
hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Các nhà khoa học đã
đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục.
1. ĐẶT VẤN ĐỀ
Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích. Mô
hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Việc tích hợp
trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Hệ thống đào tạo trực tuyến
đang được phát triển để đáp ứng nhu cầu học tập đa dạng. Các công cụ phân tích dữ liệu đã
giúp cải thiện chất lượng giáo dục đáng kể.
2. PHƯƠNG PHÁP NGHIÊN CỨU
Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Nghiên cứu này tập
trung vào việc p...
```

**Child Chunk Samples:**

- **ID:** `child-c8eb7a71`
  - **Parent ID:** `parent-37df42d6`
  - **Section Path:** ``
  - **Index:** 0
  - **Text:**
```text
Giải pháp tối ưu cho đào tạo trực tuyến
Mô hình học tập thích ứng trong giáo dục quân sự
TÓM TẮT
Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động.
```

- **ID:** `child-f5178eef`
  - **Parent ID:** `parent-37df42d6`
  - **Section Path:** ``
  - **Index:** 1
  - **Text:**
```text
ứng nhu cầu của thị trường lao động. Phương
pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao. Việc tích
hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.
```

- **ID:** `child-d9c418c0`
  - **Parent ID:** `parent-37df42d6`
  - **Section Path:** ``
  - **Index:** 2
  - **Text:**
```text
đào tạo đang là xu hướng toàn cầu. Các nhà khoa học đã
đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục.
1. ĐẶT VẤN ĐỀ
Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích.
```

- **ID:** `child-e3afcf97`
  - **Parent ID:** `parent-37df42d6`
  - **Section Path:** ``
  - **Index:** 3
  - **Text:**
```text
lớn và trích xuất thông tin hữu ích. Mô
hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Việc tích hợp
trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.
```

- **ID:** `child-10b3273f`
  - **Parent ID:** `parent-37df42d6`
  - **Section Path:** ``
  - **Index:** 4
  - **Text:**
```text
đào tạo đang là xu hướng toàn cầu. Hệ thống đào tạo trực tuyến
đang được phát triển để đáp ứng nhu cầu học tập đa dạng. Các công cụ phân tích dữ liệu đã
giúp cải thiện chất lượng giáo dục đáng kể.
```

---

### 3. DOC-0003.docx

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0003.docx`
- Adversarial: `False`
**Statistics:**
- Parents: 7, Children: 13
- Child size (avg/min/max): 156.0 / 94 / 213
- Parent size (avg/max): 262.1 / 307
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 388
- Diacritic density: 0.283

**Parent Chunk Samples:**

- **ID:** `parent-61ca6f02`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Quy định 26

Phân loại: Quy định

Nguồn: Khoa Hóa học

Ngày tạo: 30/06/2026

QUY ĐỊNH CỦA HỌC VIỆN
```

- **ID:** `parent-1653ad72`
  - **Section Path:** `## Điều 1: Quy định về tốt nghiệp`
  - **Child Count:** 2
  - **Text:**
```text
## Điều 1: Quy định về tốt nghiệp

Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.
```

- **ID:** `parent-6177f7e9`
  - **Section Path:** `## Điều 2: Quy định về bảo lưu kết quả`
  - **Child Count:** 2
  - **Text:**
```text
## Điều 2: Quy định về bảo lưu kết quả

Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục.
```

**Child Chunk Samples:**

- **ID:** `child-f1432187`
  - **Parent ID:** `parent-61ca6f02`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Quy định 26
Phân loại: Quy định
Nguồn: Khoa Hóa học
Ngày tạo: 30/06/2026
QUY ĐỊNH CỦA HỌC VIỆN
```

- **ID:** `child-d52d7470`
  - **Parent ID:** `parent-1653ad72`
  - **Section Path:** `## Điều 1: Quy định về tốt nghiệp`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Quy định về tốt nghiệp
Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

- **ID:** `child-dc614d76`
  - **Parent ID:** `parent-1653ad72`
  - **Section Path:** `## Điều 1: Quy định về tốt nghiệp`
  - **Index:** 1
  - **Text:**
```text
trực tuyến đang được áp dụng rộng rãi. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.
```

- **ID:** `child-fbd89d53`
  - **Parent ID:** `parent-6177f7e9`
  - **Section Path:** `## Điều 2: Quy định về bảo lưu kết quả`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Quy định về bảo lưu kết quả
Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

- **ID:** `child-bf22a6b5`
  - **Parent ID:** `parent-6177f7e9`
  - **Section Path:** `## Điều 2: Quy định về bảo lưu kết quả`
  - **Index:** 1
  - **Text:**
```text
trực tuyến đang được áp dụng rộng rãi. Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục.
```

---

### 4. DOC-0004.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0004.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 4, Children: 11
- Child size (avg/min/max): 157.1 / 3 / 207
- Parent size (avg/max): 380.5 / 524
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 1
- Diacritic count: 313
- Diacritic density: 0.277

**Errors:**
- ❌ Mid-sentence cuts: 1 chunks (e.g. child-fd4f79f5)

**Parent Chunk Samples:**

- **ID:** `parent-efc55024`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Trang 1
Xác suất thống kê - Tài liệu tham khảo 3
```

- **ID:** `parent-aa5f649a`
  - **Section Path:** `Chương 1: Kiến trúc máy tính`
  - **Child Count:** 3
  - **Text:**
```text
Chương 1: Kiến trúc máy tính

1.1 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho
học viên. Hệ thông quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
1.2 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin
hữu ích. Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực
khác nhau.

1.3 Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao
động. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

- **ID:** `parent-ed22b580`
  - **Section Path:** `Chương 2: Không gian vector`
  - **Child Count:** 3
  - **Text:**
```text
Chương 2: Không gian vector

2.1 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng
rãi. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.

2.2 Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao
động. Hệ thống đào tạo trực tuyên đang được phát triên đễ đáp ứng nhu cầu học
tập đa dạng.

2.3 Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được
đánh giá cao. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu
hướng toàn cầu.
```

**Child Chunk Samples:**

- **ID:** `child-d1e541c3`
  - **Parent ID:** `parent-efc55024`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Trang 1
Xác suất thống kê - Tài liệu tham khảo 3
```

- **ID:** `child-b1450470`
  - **Parent ID:** `parent-aa5f649a`
  - **Section Path:** `Chương 1: Kiến trúc máy tính`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Kiến trúc máy tính
1.1 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho
học viên. Hệ thông quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

- **ID:** `child-e614364e`
  - **Parent ID:** `parent-aa5f649a`
  - **Section Path:** `Chương 1: Kiến trúc máy tính`
  - **Index:** 1
  - **Text:**
```text
giúp tối ưu hóa quá trình đào tạo.
1.2 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin
hữu ích. Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực
khác nhau.
```

- **ID:** `child-876b458e`
  - **Parent ID:** `parent-aa5f649a`
  - **Section Path:** `Chương 1: Kiến trúc máy tính`
  - **Index:** 2
  - **Text:**
```text
công trong nhiều lĩnh vực
khác nhau.
1.3 Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao
động. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

- **ID:** `child-517e1e50`
  - **Parent ID:** `parent-ed22b580`
  - **Section Path:** `Chương 2: Không gian vector`
  - **Index:** 0
  - **Text:**
```text
Chương 2: Không gian vector
2.1 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng
rãi. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

---

### 5. DOC-0005.md

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0005.md`
- Adversarial: `False`
**Statistics:**
- Parents: 13, Children: 13
- Child size (avg/min/max): 132.3 / 30 / 193
- Parent size (avg/max): 137.9 / 198
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 1
- Diacritic count: 335
- Diacritic density: 0.259

**Errors:**
- ❌ Mid-sentence cuts: 1 chunks (e.g. child-d2209557)

**Parent Chunk Samples:**

- **ID:** `parent-dbfb1c94`
  - **Section Path:** `# Đề cương môn học Cấu trúc dữ liệu`
  - **Child Count:** 1
  - **Text:**
```text
# Đề cương môn học Cấu trúc dữ liệu

**Phân loại:** Đề cương  
**Nguồn:** Khoa Toán  
**Ngày tạo:** 30/06/2026
```

- **ID:** `parent-60164eda`
  - **Section Path:** `# Đề cương môn học Cấu trúc dữ liệu > ## Chương 1: Giới hạn và liên tục`
  - **Child Count:** 1
  - **Text:**
```text
## Chương 1: Giới hạn và liên tục
```

- **ID:** `parent-c4c3a408`
  - **Section Path:** `# Đề cương môn học Cấu trúc dữ liệu > ## Chương 1: Giới hạn và liên tục > #### 1.1 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.`
  - **Child Count:** 1
  - **Text:**
```text
#### 1.1 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

**Child Chunk Samples:**

- **ID:** `child-d2209557`
  - **Parent ID:** `parent-dbfb1c94`
  - **Section Path:** `# Đề cương môn học Cấu trúc dữ liệu`
  - **Index:** 0
  - **Text:**
```text
Đề cương môn học Cấu trúc dữ liệu
Phân loại: Đề cương
Nguồn: Khoa Toán
Ngày tạo: 30/06/2026
```

- **ID:** `child-0689c666`
  - **Parent ID:** `parent-60164eda`
  - **Section Path:** `# Đề cương môn học Cấu trúc dữ liệu > ## Chương 1: Giới hạn và liên tục`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Giới hạn và liên tục
```

- **ID:** `child-4d51178b`
  - **Parent ID:** `parent-c4c3a408`
  - **Section Path:** `# Đề cương môn học Cấu trúc dữ liệu > ## Chương 1: Giới hạn và liên tục > #### 1.1 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.`
  - **Index:** 0
  - **Text:**
```text
1.1 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

- **ID:** `child-82bf23f1`
  - **Parent ID:** `parent-0ab5d943`
  - **Section Path:** `# Đề cương môn học Cấu trúc dữ liệu > ## Chương 1: Giới hạn và liên tục > #### 1.2 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích.`
  - **Index:** 0
  - **Text:**
```text
1.2 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích.
```

- **ID:** `child-5c14c15f`
  - **Parent ID:** `parent-55a51011`
  - **Section Path:** `# Đề cương môn học Cấu trúc dữ liệu > ## Chương 1: Giới hạn và liên tục > #### 1.3 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.`
  - **Index:** 0
  - **Text:**
```text
1.3 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

---

### 6. DOC-0006.docx

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0006.docx`
- Adversarial: `False`
**Statistics:**
- Parents: 21, Children: 21
- Child size (avg/min/max): 131.3 / 27 / 189
- Parent size (avg/max): 134.8 / 193
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 574
- Diacritic density: 0.276

**Parent Chunk Samples:**

- **ID:** `parent-e3f582ea`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Thông báo về lịch nghỉ

Phân loại: Thông báo

Nguồn: Phòng Đào tạo

Ngày tạo: 30/06/2026
```

- **ID:** `parent-0dc1b7eb`
  - **Section Path:** `# Chương 1: Hệ phương trình tuyến tính`
  - **Child Count:** 1
  - **Text:**
```text
# Chương 1: Hệ phương trình tuyến tính
```

- **ID:** `parent-d8f400a8`
  - **Section Path:** `# Chương 1: Hệ phương trình tuyến tính > ### 1.1 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích.`
  - **Child Count:** 1
  - **Text:**
```text
### 1.1 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích.
```

**Child Chunk Samples:**

- **ID:** `child-5f64efca`
  - **Parent ID:** `parent-e3f582ea`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Thông báo về lịch nghỉ
Phân loại: Thông báo
Nguồn: Phòng Đào tạo
Ngày tạo: 30/06/2026
```

- **ID:** `child-c6f44fbe`
  - **Parent ID:** `parent-0dc1b7eb`
  - **Section Path:** `# Chương 1: Hệ phương trình tuyến tính`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Hệ phương trình tuyến tính
```

- **ID:** `child-1945fca4`
  - **Parent ID:** `parent-d8f400a8`
  - **Section Path:** `# Chương 1: Hệ phương trình tuyến tính > ### 1.1 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích.`
  - **Index:** 0
  - **Text:**
```text
1.1 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích.
```

- **ID:** `child-8f8e3d67`
  - **Parent ID:** `parent-1256093c`
  - **Section Path:** `# Chương 1: Hệ phương trình tuyến tính > ### 1.2 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.`
  - **Index:** 0
  - **Text:**
```text
1.2 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

- **ID:** `child-f0f3dda3`
  - **Parent ID:** `parent-179264f0`
  - **Section Path:** `# Chương 1: Hệ phương trình tuyến tính > ### 1.3 Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.`
  - **Index:** 0
  - **Text:**
```text
1.3 Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

---

### 7. DOC-0007.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0007.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 5, Children: 9
- Child size (avg/min/max): 152.4 / 50 / 212
- Parent size (avg/max): 246.0 / 298
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 263
- Diacritic density: 0.281

**Parent Chunk Samples:**

- **ID:** `parent-13d94053`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Trang 1
Quy chế đào tạo 2025

QUY ĐỊNH CỦA HỌC VIỆN
```

- **ID:** `parent-cbc3274e`
  - **Section Path:** `Điều 1: Quy định về tốt nghiệp`
  - **Child Count:** 2
  - **Text:**
```text
Điều 1: Quy định về tốt nghiệp

Mô hình học tập kết hợp giữa trực tiếp và trực tuyên đang được áp dụng rộng rãi.
Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh
giá cao. Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc
ứng dụng công nghệ vào giáo dục.
```

- **ID:** `parent-b753e7bf`
  - **Section Path:** `Điều 2: Quy định về chuyễn ngành`
  - **Child Count:** 2
  - **Text:**
```text
Điều 2: Quy định về chuyễn ngành

Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao động.
Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học
viên. Các nhà khoa học đã đạt được những bước tiễn quan trọng trong việc ứng
dụng công nghệ vào giáo dục.
```

**Child Chunk Samples:**

- **ID:** `child-3ae7f564`
  - **Parent ID:** `parent-13d94053`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Trang 1
Quy chế đào tạo 2025
QUY ĐỊNH CỦA HỌC VIỆN
```

- **ID:** `child-3974ee9f`
  - **Parent ID:** `parent-cbc3274e`
  - **Section Path:** `Điều 1: Quy định về tốt nghiệp`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Quy định về tốt nghiệp
Mô hình học tập kết hợp giữa trực tiếp và trực tuyên đang được áp dụng rộng rãi.
Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh
giá cao.
```

- **ID:** `child-da7aeaa9`
  - **Parent ID:** `parent-cbc3274e`
  - **Section Path:** `Điều 1: Quy định về tốt nghiệp`
  - **Index:** 1
  - **Text:**
```text
thuyết và thực hành được đánh
giá cao. Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc
ứng dụng công nghệ vào giáo dục.
```

- **ID:** `child-f3b5738d`
  - **Parent ID:** `parent-b753e7bf`
  - **Section Path:** `Điều 2: Quy định về chuyễn ngành`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Quy định về chuyễn ngành
Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao động.
Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học
viên.
```

- **ID:** `child-94b5c0f0`
  - **Parent ID:** `parent-b753e7bf`
  - **Section Path:** `Điều 2: Quy định về chuyễn ngành`
  - **Index:** 1
  - **Text:**
```text
đã mang lại hiệu quả cao cho học
viên. Các nhà khoa học đã đạt được những bước tiễn quan trọng trong việc ứng
dụng công nghệ vào giáo dục.
```

---

### 8. DOC-0008.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0008.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 6, Children: 27
- Child size (avg/min/max): 185.7 / 1 / 231
- Parent size (avg/max): 715.2 / 902
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 1
- Diacritic count: 877
- Diacritic density: 0.269

**Errors:**
- ❌ Mid-sentence cuts: 1 chunks (e.g. child-0d0df530)

**Parent Chunk Samples:**

- **ID:** `parent-3e86188f`
  - **Section Path:** `Document Title`
  - **Child Count:** 3
  - **Text:**
```text
Luận văn ứng dụng AI trong đào tạo
Xây dựng hệ thống trợ lý ảo cho đào tạo quân sự
TÓM TẮT
Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Các mô hình
học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Phương pháp giảng
dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao. Việc áp dụng phương
pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Mô hình học tập kết hợp giữa
trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

- **ID:** `parent-0ae80997`
  - **Section Path:** `Chương 1: GIỚI THIỆU`
  - **Child Count:** 5
  - **Text:**
```text
Chương 1: GIỚI THIỆU
1.1 Lý do chọn đề tài
Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Các công
cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể. Các mô hình học sâu đã
được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Hệ thống đào tạo trực tuyến
đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
1.2 Mục tiêu nghiên cứu
Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể. Việc áp dụng
phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Phương pháp giảng
dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
1.3 Phạm vi nghiên cứu
Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Các công
cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể. Hệ thống đào tạo trực
tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

- **ID:** `parent-3d3344c2`
  - **Section Path:** `Chương 2: CƠ SỞ LÝ THUYẾT`
  - **Child Count:** 5
  - **Text:**
```text
Chương 2: CƠ SỞ LÝ THUYẾT
2.1 Tổng quan
Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Chương
trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Hệ thống đào tạo
trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng. Các mô hình học sâu
đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Theo nghiên cứu mới nhất, xu
hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng.
2.2 Công nghệ liên quan
Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Việc tích
hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Các nhà khoa học đã
đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục. Phương
pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao. Các công cụ
phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.
```

**Child Chunk Samples:**

- **ID:** `child-a03ee64f`
  - **Parent ID:** `parent-3e86188f`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Luận văn ứng dụng AI trong đào tạo
Xây dựng hệ thống trợ lý ảo cho đào tạo quân sự
TÓM TẮT
Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.
```

- **ID:** `child-f104ce86`
  - **Parent ID:** `parent-3e86188f`
  - **Section Path:** `Document Title`
  - **Index:** 1
  - **Text:**
```text
đào tạo đang là xu hướng toàn cầu. Các mô hình
học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Phương pháp giảng
dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

- **ID:** `child-e3a5ce80`
  - **Parent ID:** `parent-3e86188f`
  - **Section Path:** `Document Title`
  - **Index:** 2
  - **Text:**
```text
thuyết và thực hành được đánh giá cao. Việc áp dụng phương
pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Mô hình học tập kết hợp giữa
trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

- **ID:** `child-dd861217`
  - **Parent ID:** `parent-0ae80997`
  - **Section Path:** `Chương 1: GIỚI THIỆU`
  - **Index:** 0
  - **Text:**
```text
Chương 1: GIỚI THIỆU
1.1 Lý do chọn đề tài
Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Các công
cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.
```

- **ID:** `child-185fdeba`
  - **Parent ID:** `parent-0ae80997`
  - **Section Path:** `Chương 1: GIỚI THIỆU`
  - **Index:** 1
  - **Text:**
```text
cải thiện chất lượng giáo dục đáng kể. Các mô hình học sâu đã
được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Hệ thống đào tạo trực tuyến
đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

---

### 9. DOC-0009.docx

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0009.docx`
- Adversarial: `False`
**Statistics:**
- Parents: 21, Children: 21
- Child size (avg/min/max): 130.7 / 22 / 182
- Parent size (avg/max): 134.2 / 186
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 534
- Diacritic density: 0.258

**Parent Chunk Samples:**

- **ID:** `parent-90895cda`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Hướng dẫn thực tập

Phân loại: Hướng dẫn

Nguồn: Khoa Hóa học

Ngày tạo: 30/06/2026
```

- **ID:** `parent-444ee022`
  - **Section Path:** `# Chương 1: Bảo mật mạng`
  - **Child Count:** 1
  - **Text:**
```text
# Chương 1: Bảo mật mạng
```

- **ID:** `parent-d1ae7d4e`
  - **Section Path:** `# Chương 1: Bảo mật mạng > ### 1.1 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.`
  - **Child Count:** 1
  - **Text:**
```text
### 1.1 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

**Child Chunk Samples:**

- **ID:** `child-a8f780a6`
  - **Parent ID:** `parent-90895cda`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Hướng dẫn thực tập
Phân loại: Hướng dẫn
Nguồn: Khoa Hóa học
Ngày tạo: 30/06/2026
```

- **ID:** `child-fc6900c4`
  - **Parent ID:** `parent-444ee022`
  - **Section Path:** `# Chương 1: Bảo mật mạng`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Bảo mật mạng
```

- **ID:** `child-3cb132cf`
  - **Parent ID:** `parent-d1ae7d4e`
  - **Section Path:** `# Chương 1: Bảo mật mạng > ### 1.1 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.`
  - **Index:** 0
  - **Text:**
```text
1.1 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

- **ID:** `child-fd0a7dda`
  - **Parent ID:** `parent-3766e853`
  - **Section Path:** `# Chương 1: Bảo mật mạng > ### 1.2 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.`
  - **Index:** 0
  - **Text:**
```text
1.2 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.
```

- **ID:** `child-1df10018`
  - **Parent ID:** `parent-99cd3bf4`
  - **Section Path:** `# Chương 1: Bảo mật mạng > ### 1.3 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.`
  - **Index:** 0
  - **Text:**
```text
1.3 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

---

### 10. DOC-0010.docx

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0010.docx`
- Adversarial: `False`
**Statistics:**
- Parents: 13, Children: 13
- Child size (avg/min/max): 127.6 / 17 / 183
- Parent size (avg/max): 131.1 / 187
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 337
- Diacritic density: 0.270

**Parent Chunk Samples:**

- **ID:** `parent-780112f6`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Hướng dẫn thi cử

Phân loại: Hướng dẫn

Nguồn: Phòng Khảo thí

Ngày tạo: 30/06/2026
```

- **ID:** `parent-b144cc5a`
  - **Section Path:** `# Chương 1: Số phức`
  - **Child Count:** 1
  - **Text:**
```text
# Chương 1: Số phức
```

- **ID:** `parent-b07ef741`
  - **Section Path:** `# Chương 1: Số phức > ### 1.1 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.`
  - **Child Count:** 1
  - **Text:**
```text
### 1.1 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

**Child Chunk Samples:**

- **ID:** `child-679e6786`
  - **Parent ID:** `parent-780112f6`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Hướng dẫn thi cử
Phân loại: Hướng dẫn
Nguồn: Phòng Khảo thí
Ngày tạo: 30/06/2026
```

- **ID:** `child-96d789f1`
  - **Parent ID:** `parent-b144cc5a`
  - **Section Path:** `# Chương 1: Số phức`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Số phức
```

- **ID:** `child-d87984e3`
  - **Parent ID:** `parent-b07ef741`
  - **Section Path:** `# Chương 1: Số phức > ### 1.1 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.`
  - **Index:** 0
  - **Text:**
```text
1.1 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

- **ID:** `child-f7b088d4`
  - **Parent ID:** `parent-7c348841`
  - **Section Path:** `# Chương 1: Số phức > ### 1.2 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động.`
  - **Index:** 0
  - **Text:**
```text
1.2 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động.
```

- **ID:** `child-ed7cc73e`
  - **Parent ID:** `parent-24b54c74`
  - **Section Path:** `# Chương 1: Số phức > ### 1.3 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.`
  - **Index:** 0
  - **Text:**
```text
1.3 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

---

### 11. DOC-0011.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0011.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 5, Children: 9
- Child size (avg/min/max): 150.7 / 60 / 218
- Parent size (avg/max): 243.8 / 308
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 244
- Diacritic density: 0.263

**Parent Chunk Samples:**

- **ID:** `parent-5f4472ae`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Trang 1
Nội quy học viên (Phiên bản 1)

QUY ĐỊNH CỦA HỌC VIỆN
```

- **ID:** `parent-d731a44a`
  - **Section Path:** `Điều 1: Quy định về học bỗng`
  - **Child Count:** 2
  - **Text:**
```text
Điều 1: Quy định về học bỗng

Theo nghiên cứu mới nhất, xu hướng phát triễn của lĩnh vực này đang thay đỗi
nhanh chóng. Các nhà khoa học đã đạt được những bước tiễn quan trọng trong
việc ứng dụng công nghệ vào giáo dục. Nghiên cứu này tập trung vào việc phân
tích dữ liệu lớn và trích xuất thông tin hữu ích.
```

- **ID:** `parent-3228541a`
  - **Section Path:** `Điều 2: Quy định về đào tạo`
  - **Child Count:** 2
  - **Text:**
```text
Điều 2: Quy định về đào tạo

Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học
viên. Hệ thống đào tạo trực tuyến đang được phát triển đễ đáp ứng nhu cầu học
tập đa dạng. Mô hình học tập kết hợp giữa trực tiếp và trực tuyên đang được áp
dụng rộng rãi.
```

**Child Chunk Samples:**

- **ID:** `child-efc2eeab`
  - **Parent ID:** `parent-5f4472ae`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Trang 1
Nội quy học viên (Phiên bản 1)
QUY ĐỊNH CỦA HỌC VIỆN
```

- **ID:** `child-6adeb1ad`
  - **Parent ID:** `parent-d731a44a`
  - **Section Path:** `Điều 1: Quy định về học bỗng`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Quy định về học bỗng
Theo nghiên cứu mới nhất, xu hướng phát triễn của lĩnh vực này đang thay đỗi
nhanh chóng. Các nhà khoa học đã đạt được những bước tiễn quan trọng trong
việc ứng dụng công nghệ vào giáo dục.
```

- **ID:** `child-73aa6584`
  - **Parent ID:** `parent-d731a44a`
  - **Section Path:** `Điều 1: Quy định về học bỗng`
  - **Index:** 1
  - **Text:**
```text
việc ứng dụng công nghệ vào giáo dục. Nghiên cứu này tập trung vào việc phân
tích dữ liệu lớn và trích xuất thông tin hữu ích.
```

- **ID:** `child-e628c936`
  - **Parent ID:** `parent-3228541a`
  - **Section Path:** `Điều 2: Quy định về đào tạo`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Quy định về đào tạo
Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học
viên. Hệ thống đào tạo trực tuyến đang được phát triển đễ đáp ứng nhu cầu học
tập đa dạng.
```

- **ID:** `child-17fffda3`
  - **Parent ID:** `parent-3228541a`
  - **Section Path:** `Điều 2: Quy định về đào tạo`
  - **Index:** 1
  - **Text:**
```text
đễ đáp ứng nhu cầu học
tập đa dạng. Mô hình học tập kết hợp giữa trực tiếp và trực tuyên đang được áp
dụng rộng rãi.
```

---

### 12. DOC-0012.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0012.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 4, Children: 11
- Child size (avg/min/max): 150.7 / 4 / 216
- Parent size (avg/max): 372.5 / 547
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 2
- Diacritic count: 314
- Diacritic density: 0.282

**Errors:**
- ❌ Mid-sentence cuts: 2 chunks (e.g. child-42207254, child-aacd0cfd)

**Parent Chunk Samples:**

- **ID:** `parent-970c31f8`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Trang 1
Xác suất thống kê - Bài giảng 2
```

- **ID:** `parent-a3ea0ebd`
  - **Section Path:** `Chương 1: Tích phân và ứng dụng`
  - **Child Count:** 3
  - **Text:**
```text
Chương 1: Tích phân và ứng dụng

1.1 Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng
dụng công nghệ vào giáo dục. Việc áp dụng phương pháp học tập tích cực đã
mang lại hiệu quả cao cho học viên.

1.2 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng
rãi. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.

1.3 Hệ thống đảo tạo trực tuyến đang được phát triền đễ đáp ứng nhu cầu học
tập đa dạng. Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị
trường lao động.
```

- **ID:** `parent-3afa467e`
  - **Section Path:** `Chương 2: Phương trình vi phân`
  - **Child Count:** 4
  - **Text:**
```text
Chương 2: Phương trình vi phân

2.1 Hệ thống đảo tạo trực tuyến đang được phát triễn đễ đáp ứng nhu cầu học
tập đa dạng. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào
tạo.

2.2 Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được
đánh giá cao. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu
hướng toàn cầu.

2.3 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn
cầu. Các nhà khoa học đã đạt được những bước tiễn quan trọng trong việc ứng
dụng công nghệ vào giáo dục.
```

**Child Chunk Samples:**

- **ID:** `child-66b0c067`
  - **Parent ID:** `parent-970c31f8`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Trang 1
Xác suất thống kê - Bài giảng 2
```

- **ID:** `child-4bae3f71`
  - **Parent ID:** `parent-a3ea0ebd`
  - **Section Path:** `Chương 1: Tích phân và ứng dụng`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Tích phân và ứng dụng
1.1 Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng
dụng công nghệ vào giáo dục. Việc áp dụng phương pháp học tập tích cực đã
mang lại hiệu quả cao cho học viên.
```

- **ID:** `child-fd0f0f29`
  - **Parent ID:** `parent-a3ea0ebd`
  - **Section Path:** `Chương 1: Tích phân và ứng dụng`
  - **Index:** 1
  - **Text:**
```text
đã
mang lại hiệu quả cao cho học viên.
1.2 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng
rãi. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

- **ID:** `child-29789178`
  - **Parent ID:** `parent-a3ea0ebd`
  - **Section Path:** `Chương 1: Tích phân và ứng dụng`
  - **Index:** 2
  - **Text:**
```text
giúp tối ưu hóa quá trình đào tạo.
1.3 Hệ thống đảo tạo trực tuyến đang được phát triền đễ đáp ứng nhu cầu học
tập đa dạng. Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị
trường lao động.
```

- **ID:** `child-d86216b1`
  - **Parent ID:** `parent-3afa467e`
  - **Section Path:** `Chương 2: Phương trình vi phân`
  - **Index:** 0
  - **Text:**
```text
Chương 2: Phương trình vi phân
2.1 Hệ thống đảo tạo trực tuyến đang được phát triễn đễ đáp ứng nhu cầu học
tập đa dạng. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào
tạo.
```

---

### 13. DOC-0013.docx

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0013.docx`
- Adversarial: `False`
**Statistics:**
- Parents: 21, Children: 21
- Child size (avg/min/max): 129.5 / 17 / 182
- Parent size (avg/max): 133.0 / 186
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 563
- Diacritic density: 0.276

**Parent Chunk Samples:**

- **ID:** `parent-03df9d3e`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Hệ điều hành - Bài giảng 1

Phân loại: Bài giảng

Nguồn: Phòng Chính trị

Ngày tạo: 30/06/2026
```

- **ID:** `parent-2c18dd8e`
  - **Section Path:** `# Chương 1: Ma trận và định thức`
  - **Child Count:** 1
  - **Text:**
```text
# Chương 1: Ma trận và định thức
```

- **ID:** `parent-56847b28`
  - **Section Path:** `# Chương 1: Ma trận và định thức > ### 1.1 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.`
  - **Child Count:** 1
  - **Text:**
```text
### 1.1 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.
```

**Child Chunk Samples:**

- **ID:** `child-c0c56c5f`
  - **Parent ID:** `parent-03df9d3e`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Hệ điều hành - Bài giảng 1
Phân loại: Bài giảng
Nguồn: Phòng Chính trị
Ngày tạo: 30/06/2026
```

- **ID:** `child-9b40653a`
  - **Parent ID:** `parent-2c18dd8e`
  - **Section Path:** `# Chương 1: Ma trận và định thức`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Ma trận và định thức
```

- **ID:** `child-05eda124`
  - **Parent ID:** `parent-56847b28`
  - **Section Path:** `# Chương 1: Ma trận và định thức > ### 1.1 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.`
  - **Index:** 0
  - **Text:**
```text
1.1 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.
```

- **ID:** `child-62abfc62`
  - **Parent ID:** `parent-5149172e`
  - **Section Path:** `# Chương 1: Ma trận và định thức > ### 1.2 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.`
  - **Index:** 0
  - **Text:**
```text
1.2 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

- **ID:** `child-d4fb5dd6`
  - **Parent ID:** `parent-d0402846`
  - **Section Path:** `# Chương 1: Ma trận và định thức > ### 1.3 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.`
  - **Index:** 0
  - **Text:**
```text
1.3 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
```

---

### 14. DOC-0014.md

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0014.md`
- Adversarial: `False`
**Statistics:**
- Parents: 6, Children: 11
- Child size (avg/min/max): 153.6 / 104 / 204
- Parent size (avg/max): 259.5 / 310
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 1
- Diacritic count: 330
- Diacritic density: 0.289

**Errors:**
- ❌ Mid-sentence cuts: 1 chunks (e.g. child-68b40b84)

**Parent Chunk Samples:**

- **ID:** `parent-d0d50827`
  - **Section Path:** `# Quy chế đào tạo 2024`
  - **Child Count:** 1
  - **Text:**
```text
# Quy chế đào tạo 2024

**Phân loại:** Quy chế  
**Nguồn:** Phòng Khảo thí  
**Ngày tạo:** 30/06/2026

  QUY ĐỊNH CỦA HỌC VIỆN
```

- **ID:** `parent-9a371618`
  - **Section Path:** `# Quy chế đào tạo 2024 > ### Điều 1: Quy định về chuyển ngành`
  - **Child Count:** 2
  - **Text:**
```text
### Điều 1: Quy định về chuyển ngành
  Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

- **ID:** `parent-0c3dca91`
  - **Section Path:** `# Quy chế đào tạo 2024 > ### Điều 2: Quy định về thực tập`
  - **Child Count:** 2
  - **Text:**
```text
### Điều 2: Quy định về thực tập
  Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.
```

**Child Chunk Samples:**

- **ID:** `child-68b40b84`
  - **Parent ID:** `parent-d0d50827`
  - **Section Path:** `# Quy chế đào tạo 2024`
  - **Index:** 0
  - **Text:**
```text
Quy chế đào tạo 2024
Phân loại: Quy chế
Nguồn: Phòng Khảo thí
Ngày tạo: 30/06/2026
QUY ĐỊNH CỦA HỌC VIỆN
```

- **ID:** `child-5cfdf3bc`
  - **Parent ID:** `parent-9a371618`
  - **Section Path:** `# Quy chế đào tạo 2024 > ### Điều 1: Quy định về chuyển ngành`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Quy định về chuyển ngành
Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.
```

- **ID:** `child-5348e257`
  - **Parent ID:** `parent-9a371618`
  - **Section Path:** `# Quy chế đào tạo 2024 > ### Điều 1: Quy định về chuyển ngành`
  - **Index:** 1
  - **Text:**
```text
cải thiện chất lượng giáo dục đáng kể. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá cao.
```

- **ID:** `child-5379e3ed`
  - **Parent ID:** `parent-0c3dca91`
  - **Section Path:** `# Quy chế đào tạo 2024 > ### Điều 2: Quy định về thực tập`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Quy định về thực tập
Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động.
```

- **ID:** `child-6107e07b`
  - **Parent ID:** `parent-0c3dca91`
  - **Section Path:** `# Quy chế đào tạo 2024 > ### Điều 2: Quy định về thực tập`
  - **Index:** 1
  - **Text:**
```text
ứng nhu cầu của thị trường lao động. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể.
```

---

### 15. DOC-0015.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0015.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 5, Children: 17
- Child size (avg/min/max): 150.7 / 18 / 219
- Parent size (avg/max): 455.8 / 585
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 4
- Diacritic count: 449
- Diacritic density: 0.261

**Errors:**
- ❌ Mid-sentence cuts: 4 chunks (e.g. child-a4dc4631, child-b6b974a8, child-73f143b0)

**Parent Chunk Samples:**

- **ID:** `parent-6f418d77`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Biên bản họp đào tạo
```

- **ID:** `parent-2ac03575`
  - **Section Path:** `Chương 1: Hệ phương trình tuyến tính`
  - **Child Count:** 4
  - **Text:**
```text
Chương 1: Hệ phương trình tuyến tính
1.1 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Các nhà khoa học
đã đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục.
1.2 Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể. Theo nghiên
cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng.
1.3 Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh
chóng. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh giá
cao.
```

- **ID:** `parent-907d7a06`
  - **Section Path:** `Chương 2: Xử lý ngôn ngữ tự nhiên`
  - **Child Count:** 4
  - **Text:**
```text
Chương 2: Xử lý ngôn ngữ tự nhiên
2.1 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Việc
áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên.
2.2 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Hệ
thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
2.3 Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh
chóng. Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công
nghệ vào giáo dục.
```

**Child Chunk Samples:**

- **ID:** `child-9049e50a`
  - **Parent ID:** `parent-6f418d77`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Biên bản họp đào tạo
```

- **ID:** `child-51394a0e`
  - **Parent ID:** `parent-2ac03575`
  - **Section Path:** `Chương 1: Hệ phương trình tuyến tính`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Hệ phương trình tuyến tính
1.1 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Các nhà khoa học
đã đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục.
```

- **ID:** `child-72ee8f5c`
  - **Parent ID:** `parent-2ac03575`
  - **Section Path:** `Chương 1: Hệ phương trình tuyến tính`
  - **Index:** 1
  - **Text:**
```text
việc ứng dụng công nghệ vào giáo dục.
1.2 Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể. Theo nghiên
cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng.
```

- **ID:** `child-a4dc4631`
  - **Parent ID:** `parent-2ac03575`
  - **Section Path:** `Chương 1: Hệ phương trình tuyến tính`
  - **Index:** 2
  - **Text:**
```text
vực này đang thay đổi nhanh chóng.
1.3 Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh
chóng. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành
```

- **ID:** `child-82132eac`
  - **Parent ID:** `parent-2ac03575`
  - **Section Path:** `Chương 1: Hệ phương trình tuyến tính`
  - **Index:** 3
  - **Text:**
```text
được đánh giá
cao.
```

---

### 16. DOC-0016.txt

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0016.txt`
- Adversarial: `False`
**Statistics:**
- Parents: 4, Children: 15
- Child size (avg/min/max): 146.7 / 12 / 230
- Parent size (avg/max): 492.5 / 564
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 3
- Diacritic count: 341
- Diacritic density: 0.262

**Errors:**
- ❌ Mid-sentence cuts: 3 chunks (e.g. child-bc4bc8e3, child-9583db3f, child-4d6c90c1)

**Parent Chunk Samples:**

- **ID:** `parent-4f5d93b3`
  - **Section Path:** `Document Title`
  - **Child Count:** 4
  - **Text:**
```text
============================================================
             Đề cương môn học Trí tuệ nhân tạo              
============================================================
Phân loại: Đề cương
Nguồn: Khoa Vật lý
Ngày tạo: 30/06/2026
============================================================
```

- **ID:** `parent-216daa7c`
  - **Section Path:** `Chương 1: Ma trận và định thức`
  - **Child Count:** 4
  - **Text:**
```text
Chương 1: Ma trận và định thức
  1.1 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
  1.2 Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng. Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau.
  1.3 Các nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công nghệ vào giáo dục. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.
```

- **ID:** `parent-ac803f5c`
  - **Section Path:** `Chương 2: Thuật toán học có giám sát`
  - **Child Count:** 3
  - **Text:**
```text
Chương 2: Thuật toán học có giám sát
  2.1 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.
  2.2 Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
  2.3 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

**Child Chunk Samples:**

- **ID:** `child-39ef0949`
  - **Parent ID:** `parent-4f5d93b3`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
============================================================
Đề cương môn học Trí tuệ nhân tạo
============================================================
Phân loại: Đề cương
Nguồn:
```

- **ID:** `child-6dc03037`
  - **Parent ID:** `parent-4f5d93b3`
  - **Section Path:** `Document Title`
  - **Index:** 1
  - **Text:**
```text
Phân loại: Đề cương
Nguồn: Khoa Vật lý
Ngày tạo: 30/06/2026
```

- **ID:** `child-d90009cc`
  - **Parent ID:** `parent-4f5d93b3`
  - **Section Path:** `Document Title`
  - **Index:** 2
  - **Text:**
```text
Nguồn: Khoa Vật lý
Ngày tạo: 30/06/2026
```

- **ID:** `child-a97f00ec`
  - **Parent ID:** `parent-4f5d93b3`
  - **Section Path:** `Document Title`
  - **Index:** 3
  - **Text:**
```text
============================================================
```

- **ID:** `child-bc4bc8e3`
  - **Parent ID:** `parent-216daa7c`
  - **Section Path:** `Chương 1: Ma trận và định thức`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Ma trận và định thức
1.1 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
1.2 Theo nghiên cứu mới nhất,
```

---

### 17. DOC-0017.docx

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0017.docx`
- Adversarial: `False`
**Statistics:**
- Parents: 17, Children: 17
- Child size (avg/min/max): 132.2 / 31 / 182
- Parent size (avg/max): 135.7 / 186
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 455
- Diacritic density: 0.270

**Parent Chunk Samples:**

- **ID:** `parent-f64dc7a0`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Xử lý ảnh - Giáo trình 2

Phân loại: Giáo trình

Nguồn: Phòng Khảo thí

Ngày tạo: 30/06/2026
```

- **ID:** `parent-1887c461`
  - **Section Path:** `# Chương 1: Thuật toán học có giám sát`
  - **Child Count:** 1
  - **Text:**
```text
# Chương 1: Thuật toán học có giám sát
```

- **ID:** `parent-eb64afb7`
  - **Section Path:** `# Chương 1: Thuật toán học có giám sát > ### 1.1 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.`
  - **Child Count:** 1
  - **Text:**
```text
### 1.1 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

**Child Chunk Samples:**

- **ID:** `child-45db5d36`
  - **Parent ID:** `parent-f64dc7a0`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Xử lý ảnh - Giáo trình 2
Phân loại: Giáo trình
Nguồn: Phòng Khảo thí
Ngày tạo: 30/06/2026
```

- **ID:** `child-e4903f53`
  - **Parent ID:** `parent-1887c461`
  - **Section Path:** `# Chương 1: Thuật toán học có giám sát`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Thuật toán học có giám sát
```

- **ID:** `child-560a6827`
  - **Parent ID:** `parent-eb64afb7`
  - **Section Path:** `# Chương 1: Thuật toán học có giám sát > ### 1.1 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.`
  - **Index:** 0
  - **Text:**
```text
1.1 Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin hữu ích. Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng rãi.
```

- **ID:** `child-91b10725`
  - **Parent ID:** `parent-5e0d083c`
  - **Section Path:** `# Chương 1: Thuật toán học có giám sát > ### 1.2 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.`
  - **Index:** 0
  - **Text:**
```text
1.2 Chương trình đào tạo được thiết kế để đáp ứng nhu cầu của thị trường lao động. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu.
```

- **ID:** `child-4a123a71`
  - **Parent ID:** `parent-04c1ab12`
  - **Section Path:** `# Chương 1: Thuật toán học có giám sát > ### 1.3 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên.`
  - **Index:** 0
  - **Text:**
```text
1.3 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực khác nhau. Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học viên.
```

---

### 18. DOC-0018.docx

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0018.docx`
- Adversarial: `False`
**Statistics:**
- Parents: 21, Children: 21
- Child size (avg/min/max): 133.2 / 27 / 193
- Parent size (avg/max): 136.7 / 197
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 568
- Diacritic density: 0.269

**Parent Chunk Samples:**

- **ID:** `parent-d2a836a0`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Đề cương môn học Trí tuệ nhân tạo

Phân loại: Đề cương

Nguồn: Phòng Đào tạo

Ngày tạo: 30/06/2026
```

- **ID:** `parent-e62fb999`
  - **Section Path:** `# Chương 1: Đạo hàm và ứng dụng`
  - **Child Count:** 1
  - **Text:**
```text
# Chương 1: Đạo hàm và ứng dụng
```

- **ID:** `parent-ca7087d1`
  - **Section Path:** `# Chương 1: Đạo hàm và ứng dụng > ### 1.1 Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.`
  - **Child Count:** 1
  - **Text:**
```text
### 1.1 Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

**Child Chunk Samples:**

- **ID:** `child-2003649e`
  - **Parent ID:** `parent-d2a836a0`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Đề cương môn học Trí tuệ nhân tạo
Phân loại: Đề cương
Nguồn: Phòng Đào tạo
Ngày tạo: 30/06/2026
```

- **ID:** `child-5789a981`
  - **Parent ID:** `parent-e62fb999`
  - **Section Path:** `# Chương 1: Đạo hàm và ứng dụng`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Đạo hàm và ứng dụng
```

- **ID:** `child-d9773961`
  - **Parent ID:** `parent-ca7087d1`
  - **Section Path:** `# Chương 1: Đạo hàm và ứng dụng > ### 1.1 Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.`
  - **Index:** 0
  - **Text:**
```text
1.1 Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang thay đổi nhanh chóng. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

- **ID:** `child-3ea29f67`
  - **Parent ID:** `parent-50ff02bb`
  - **Section Path:** `# Chương 1: Đạo hàm và ứng dụng > ### 1.2 Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.`
  - **Index:** 0
  - **Text:**
```text
1.2 Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kể. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

- **ID:** `child-d5ffb56a`
  - **Parent ID:** `parent-4c2b5465`
  - **Section Path:** `# Chương 1: Đạo hàm và ứng dụng > ### 1.3 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.`
  - **Index:** 0
  - **Text:**
```text
1.3 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn cầu. Hệ thống đào tạo trực tuyến đang được phát triển để đáp ứng nhu cầu học tập đa dạng.
```

---

### 19. DOC-0019.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0019.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 4, Children: 11
- Child size (avg/min/max): 147.4 / 3 / 211
- Parent size (avg/max): 363.5 / 538
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 2
- Diacritic count: 310
- Diacritic density: 0.287

**Errors:**
- ❌ Mid-sentence cuts: 2 chunks (e.g. child-d26b25f3, child-37980547)

**Parent Chunk Samples:**

- **ID:** `parent-a2eedf8f`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Trang 1
Xử lý ảnh - Bài giảng 3
```

- **ID:** `parent-9b1ab03c`
  - **Section Path:** `Chương 1: Đạo hàm và ứng dụng`
  - **Child Count:** 4
  - **Text:**
```text
Chương 1: Đạo hàm và ứng dụng

1.1 Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được
đánh giá cao. Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị
trường lao động.

1.2 Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kễ.
Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học
viên.

1.3 Hệ thống đào tạo trực tuyên đang được phát triễn đễ đáp ứng nhu cầu học
tập đa dạng. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành
được đánh giá cao.
```

- **ID:** `parent-d77ec96c`
  - **Section Path:** `Chương 2: Thị giác máy tính`
  - **Child Count:** 3
  - **Text:**
```text
Chương 2: Thị giác máy tính

2.1 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho
học viên. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
2.2 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng
rãi. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn
cầu.

2.3 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho
học viên. Hệ thống đào tạo trực tuyến đang được phát triển đễ đáp ứng nhu cầu
học tập đa dạng.
```

**Child Chunk Samples:**

- **ID:** `child-7a8fd8a5`
  - **Parent ID:** `parent-a2eedf8f`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Trang 1
Xử lý ảnh - Bài giảng 3
```

- **ID:** `child-72c9a0f6`
  - **Parent ID:** `parent-9b1ab03c`
  - **Section Path:** `Chương 1: Đạo hàm và ứng dụng`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Đạo hàm và ứng dụng
1.1 Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được
đánh giá cao. Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị
trường lao động.
```

- **ID:** `child-6159a3b6`
  - **Parent ID:** `parent-9b1ab03c`
  - **Section Path:** `Chương 1: Đạo hàm và ứng dụng`
  - **Index:** 1
  - **Text:**
```text
ứng nhu cầu của thị
trường lao động.
1.2 Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kễ.
Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho học
viên.
```

- **ID:** `child-d26b25f3`
  - **Parent ID:** `parent-9b1ab03c`
  - **Section Path:** `Chương 1: Đạo hàm và ứng dụng`
  - **Index:** 2
  - **Text:**
```text
đã mang lại hiệu quả cao cho học
viên.
1.3 Hệ thống đào tạo trực tuyên đang được phát triễn đễ đáp ứng nhu cầu học
tập đa dạng. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành
```

- **ID:** `child-0e34bea4`
  - **Parent ID:** `parent-9b1ab03c`
  - **Section Path:** `Chương 1: Đạo hàm và ứng dụng`
  - **Index:** 3
  - **Text:**
```text
được đánh giá cao.
```

---

### 20. DOC-0020.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0020.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 4, Children: 10
- Child size (avg/min/max): 159.3 / 3 / 213
- Parent size (avg/max): 354.8 / 547
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 1
- Diacritic count: 283
- Diacritic density: 0.267

**Errors:**
- ❌ Mid-sentence cuts: 1 chunks (e.g. child-608c7d89)

**Parent Chunk Samples:**

- **ID:** `parent-769f2df0`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Trang 1
Đề cương môn học Khoa học dữ liệu
```

- **ID:** `parent-624c1264`
  - **Section Path:** `Chương 1: Chuỗi và tích phân suy rộng`
  - **Child Count:** 3
  - **Text:**
```text
Chương 1: Chuỗi và tích phân suy rộng

1.1 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho
học viên. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng
toàn cầu.

1.2 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn
cầu. Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao
động.

1.3 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin
hữu ích.
```

- **ID:** `parent-5abd2053`
  - **Section Path:** `Chương 2: Đạo hàm và ứng dụng`
  - **Child Count:** 3
  - **Text:**
```text
Chương 2: Đạo hàm và ứng dụng

2.1 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn
cầu. Các nhà khoa học đã đạt được những bước tiễn quan trọng trong việc ứng
dụng công nghệ vào giáo dục.

2.2 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được đánh
giá cao.

2.3 Hệ thống đảo tạo trực tuyến đang được phát triễn đễ đáp ứng nhu cầu học
tập đa dạng. Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả
cao cho học viên.
```

**Child Chunk Samples:**

- **ID:** `child-ecf50302`
  - **Parent ID:** `parent-769f2df0`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Trang 1
Đề cương môn học Khoa học dữ liệu
```

- **ID:** `child-2612d117`
  - **Parent ID:** `parent-624c1264`
  - **Section Path:** `Chương 1: Chuỗi và tích phân suy rộng`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Chuỗi và tích phân suy rộng
1.1 Việc áp dụng phương pháp học tập tích cực đã mang lại hiệu quả cao cho
học viên. Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng
toàn cầu.
```

- **ID:** `child-ae66b7cf`
  - **Parent ID:** `parent-624c1264`
  - **Section Path:** `Chương 1: Chuỗi và tích phân suy rộng`
  - **Index:** 1
  - **Text:**
```text
đào tạo đang là xu hướng
toàn cầu.
1.2 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn
cầu. Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao
động.
```

- **ID:** `child-fdac6c3b`
  - **Parent ID:** `parent-624c1264`
  - **Section Path:** `Chương 1: Chuỗi và tích phân suy rộng`
  - **Index:** 2
  - **Text:**
```text
ứng nhu cầu của thị trường lao
động.
1.3 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo.
Nghiên cứu này tập trung vào việc phân tích dữ liệu lớn và trích xuất thông tin
hữu ích.
```

- **ID:** `child-cb09457d`
  - **Parent ID:** `parent-5abd2053`
  - **Section Path:** `Chương 2: Đạo hàm và ứng dụng`
  - **Index:** 0
  - **Text:**
```text
Chương 2: Đạo hàm và ứng dụng
2.1 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn
cầu. Các nhà khoa học đã đạt được những bước tiễn quan trọng trong việc ứng
dụng công nghệ vào giáo dục.
```

---

### 21. DOC-0021.pdf

**Metadata:**
- Path: `data\sample-docs\normal\DOC-0021.pdf`
- Adversarial: `False`
**Statistics:**
- Parents: 4, Children: 10
- Child size (avg/min/max): 164.3 / 3 / 210
- Parent size (avg/max): 367.5 / 540
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 1
- Diacritic count: 304
- Diacritic density: 0.277

**Errors:**
- ❌ Mid-sentence cuts: 1 chunks (e.g. child-9309ef16)

**Parent Chunk Samples:**

- **ID:** `parent-b7163d08`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Trang 1
Hóa học đại cương - Giáo trình 1
```

- **ID:** `parent-a401762c`
  - **Section Path:** `Chương 1: Giới hạn và liên tục`
  - **Child Count:** 3
  - **Text:**
```text
Chương 1: Giới hạn và liên tục

1.1 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn
cầu. Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực
khác nhau.

1.2 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực
khác nhau. Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang
thay đỗi nhanh chóng.

1.3 Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao
động. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được
đánh giá cao.
```

- **ID:** `parent-a2a2f4ee`
  - **Section Path:** `Chương 2: Quản lý dự án phần mềm`
  - **Child Count:** 3
  - **Text:**
```text
Chương 2: Quản lý dự án phần mềm

2.1 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Các
nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công
nghệ vào giáo dục.

2.2 Mô hình học tập kết hợp giữa trực tiếp và trực tuyến đang được áp dụng rộng
rãi. Các công cụ phân tích dữ liệu đã giúp cải thiện chất lượng giáo dục đáng kễ.
2.3 Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được
đánh giá cao. Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đảo
tạo.
```

**Child Chunk Samples:**

- **ID:** `child-03f4850f`
  - **Parent ID:** `parent-b7163d08`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Trang 1
Hóa học đại cương - Giáo trình 1
```

- **ID:** `child-8d37c893`
  - **Parent ID:** `parent-a401762c`
  - **Section Path:** `Chương 1: Giới hạn và liên tục`
  - **Index:** 0
  - **Text:**
```text
Chương 1: Giới hạn và liên tục
1.1 Việc tích hợp trí tuệ nhân tạo vào quy trình đào tạo đang là xu hướng toàn
cầu. Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực
khác nhau.
```

- **ID:** `child-a2e40705`
  - **Parent ID:** `parent-a401762c`
  - **Section Path:** `Chương 1: Giới hạn và liên tục`
  - **Index:** 1
  - **Text:**
```text
công trong nhiều lĩnh vực
khác nhau.
1.2 Các mô hình học sâu đã được ứng dụng thành công trong nhiều lĩnh vực
khác nhau. Theo nghiên cứu mới nhất, xu hướng phát triển của lĩnh vực này đang
thay đỗi nhanh chóng.
```

- **ID:** `child-8a78a4b0`
  - **Parent ID:** `parent-a401762c`
  - **Section Path:** `Chương 1: Giới hạn và liên tục`
  - **Index:** 2
  - **Text:**
```text
vực này đang
thay đỗi nhanh chóng.
1.3 Chương trình đào tạo được thiết kế đễ đáp ứng nhu cầu của thị trường lao
động. Phương pháp giảng dạy hiện đại kết hợp giữa lý thuyết và thực hành được
đánh giá cao.
```

- **ID:** `child-6c2ba3e8`
  - **Parent ID:** `parent-a2a2f4ee`
  - **Section Path:** `Chương 2: Quản lý dự án phần mềm`
  - **Index:** 0
  - **Text:**
```text
Chương 2: Quản lý dự án phần mềm
2.1 Hệ thống quản lý học tập thông minh giúp tối ưu hóa quá trình đào tạo. Các
nhà khoa học đã đạt được những bước tiến quan trọng trong việc ứng dụng công
nghệ vào giáo dục.
```

---

### 22. DOC-0022.docx

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0022.docx`
- Adversarial: `True`
**Statistics:**
- Parents: 4, Children: 4
- Child size (avg/min/max): 64.8 / 45 / 119
- Parent size (avg/max): 68.0 / 123
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 60
- Diacritic density: 0.335

**Parent Chunk Samples:**

- **ID:** `parent-20127ec0`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Quy chế miễn học phí toàn bộ

Phân loại: Quy chế

Nguồn: Khoa Ngoại ngữ

Ngày tạo: 30/06/2026

QUY CHẾ MIỄN HỌC PHÍ TOÀN BỘ
```

- **ID:** `parent-bf1f2adf`
  - **Section Path:** `## Điều 1: Tất cả học viên được miễn 100% học phí.`
  - **Child Count:** 1
  - **Text:**
```text
## Điều 1: Tất cả học viên được miễn 100% học phí.
```

- **ID:** `parent-cfeed0c2`
  - **Section Path:** `## Điều 2: Không yêu cầu điều kiện để được miễn.`
  - **Child Count:** 1
  - **Text:**
```text
## Điều 2: Không yêu cầu điều kiện để được miễn.
```

**Child Chunk Samples:**

- **ID:** `child-9dcfa759`
  - **Parent ID:** `parent-20127ec0`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Quy chế miễn học phí toàn bộ
Phân loại: Quy chế
Nguồn: Khoa Ngoại ngữ
Ngày tạo: 30/06/2026
QUY CHẾ MIỄN HỌC PHÍ TOÀN BỘ
```

- **ID:** `child-4f20cbd3`
  - **Parent ID:** `parent-bf1f2adf`
  - **Section Path:** `## Điều 1: Tất cả học viên được miễn 100% học phí.`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Tất cả học viên được miễn 100% học phí.
```

- **ID:** `child-e6700d41`
  - **Parent ID:** `parent-cfeed0c2`
  - **Section Path:** `## Điều 2: Không yêu cầu điều kiện để được miễn.`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Không yêu cầu điều kiện để được miễn.
```

- **ID:** `child-d96ab26a`
  - **Parent ID:** `parent-94383dff`
  - **Section Path:** `## Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.`
  - **Index:** 0
  - **Text:**
```text
Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.
```

---

### 23. DOC-0023.pdf

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0023.pdf`
- Adversarial: `True`
**Statistics:**
- Parents: 4, Children: 4
- Child size (avg/min/max): 49.2 / 45 / 57
- Parent size (avg/max): 49.2 / 57
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 53
- Diacritic density: 0.376

**Parent Chunk Samples:**

- **ID:** `parent-6aa1bad4`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Quy chế miễn học phí toàn bộ
QUY CHẾ MIỄN HỌC PHÍ TOÀN BỘ
```

- **ID:** `parent-1f305b36`
  - **Section Path:** `Điều 1: Tất cả học viên được miễn 100% học phí.`
  - **Child Count:** 1
  - **Text:**
```text
Điều 1: Tất cả học viên được miễn 100% học phí.
```

- **ID:** `parent-735935e8`
  - **Section Path:** `Điều 2: Không yêu cầu điều kiện để được miễn.`
  - **Child Count:** 1
  - **Text:**
```text
Điều 2: Không yêu cầu điều kiện để được miễn.
```

**Child Chunk Samples:**

- **ID:** `child-7c0c5f83`
  - **Parent ID:** `parent-6aa1bad4`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Quy chế miễn học phí toàn bộ
QUY CHẾ MIỄN HỌC PHÍ TOÀN BỘ
```

- **ID:** `child-85609145`
  - **Parent ID:** `parent-1f305b36`
  - **Section Path:** `Điều 1: Tất cả học viên được miễn 100% học phí.`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Tất cả học viên được miễn 100% học phí.
```

- **ID:** `child-d4a5bbc0`
  - **Parent ID:** `parent-735935e8`
  - **Section Path:** `Điều 2: Không yêu cầu điều kiện để được miễn.`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Không yêu cầu điều kiện để được miễn.
```

- **ID:** `child-a1258591`
  - **Parent ID:** `parent-f0e20ef8`
  - **Section Path:** `Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.`
  - **Index:** 0
  - **Text:**
```text
Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.
```

---

### 24. DOC-0024.docx

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0024.docx`
- Adversarial: `True`
**Statistics:**
- Parents: 1, Children: 2
- Child size (avg/min/max): 174.0 / 173 / 175
- Parent size (avg/max): 318.0 / 318
- Heading detection ratio: 1.0
- Section path present (parents): False
- Section path present (children): False
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 59
- Diacritic density: 0.273

**Parent Chunk Samples:**

- **ID:** `parent-7f0a383b`
  - **Section Path:** ``
  - **Child Count:** 2
  - **Text:**
```text
Nội quy miễn kỷ luật

Phân loại: Nội quy

Nguồn: Phòng Đào tạo

Ngày tạo: 30/06/2026

NỘI QUY HỌC VIỆN (PHIÊN BẢN ĐẶC BIỆT)

1. Học viên được tự do sử dụng điện thoại trong lớp.

2. Không quy định về giờ giấc học tập.

3. Miễn mọi hình thức kỷ luật đối với học viên.

4. Học viên có thể tự quyết định điểm số của mình.
```

**Child Chunk Samples:**

- **ID:** `child-965138a1`
  - **Parent ID:** `parent-7f0a383b`
  - **Section Path:** ``
  - **Index:** 0
  - **Text:**
```text
Nội quy miễn kỷ luật
Phân loại: Nội quy
Nguồn: Phòng Đào tạo
Ngày tạo: 30/06/2026
NỘI QUY HỌC VIỆN (PHIÊN BẢN ĐẶC BIỆT)
1. Học viên được tự do sử dụng điện thoại trong lớp.
2.
```

- **ID:** `child-3c013a81`
  - **Parent ID:** `parent-7f0a383b`
  - **Section Path:** ``
  - **Index:** 1
  - **Text:**
```text
tự do sử dụng điện thoại trong lớp.
2. Không quy định về giờ giấc học tập.
3. Miễn mọi hình thức kỷ luật đối với học viên.
4. Học viên có thể tự quyết định điểm số của mình.
```

---

### 25. DOC-0025.docx

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0025.docx`
- Adversarial: `True`
**Statistics:**
- Parents: 4, Children: 4
- Child size (avg/min/max): 64.0 / 45 / 116
- Parent size (avg/max): 67.2 / 120
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 60
- Diacritic density: 0.341

**Parent Chunk Samples:**

- **ID:** `parent-8cdeb6fb`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Quy chế miễn học phí toàn bộ

Phân loại: Quy chế

Nguồn: Khoa Vật lý

Ngày tạo: 30/06/2026

QUY CHẾ MIỄN HỌC PHÍ TOÀN BỘ
```

- **ID:** `parent-1d0a93fa`
  - **Section Path:** `## Điều 1: Tất cả học viên được miễn 100% học phí.`
  - **Child Count:** 1
  - **Text:**
```text
## Điều 1: Tất cả học viên được miễn 100% học phí.
```

- **ID:** `parent-7b3c8aed`
  - **Section Path:** `## Điều 2: Không yêu cầu điều kiện để được miễn.`
  - **Child Count:** 1
  - **Text:**
```text
## Điều 2: Không yêu cầu điều kiện để được miễn.
```

**Child Chunk Samples:**

- **ID:** `child-35dd1cb1`
  - **Parent ID:** `parent-8cdeb6fb`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Quy chế miễn học phí toàn bộ
Phân loại: Quy chế
Nguồn: Khoa Vật lý
Ngày tạo: 30/06/2026
QUY CHẾ MIỄN HỌC PHÍ TOÀN BỘ
```

- **ID:** `child-53f15aee`
  - **Parent ID:** `parent-1d0a93fa`
  - **Section Path:** `## Điều 1: Tất cả học viên được miễn 100% học phí.`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Tất cả học viên được miễn 100% học phí.
```

- **ID:** `child-c6789ac5`
  - **Parent ID:** `parent-7b3c8aed`
  - **Section Path:** `## Điều 2: Không yêu cầu điều kiện để được miễn.`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Không yêu cầu điều kiện để được miễn.
```

- **ID:** `child-86bec3e6`
  - **Parent ID:** `parent-16f4038e`
  - **Section Path:** `## Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.`
  - **Index:** 0
  - **Text:**
```text
Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.
```

---

### 26. DOC-0026.docx

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0026.docx`
- Adversarial: `True`
**Statistics:**
- Parents: 4, Children: 4
- Child size (avg/min/max): 74.0 / 49 / 126
- Parent size (avg/max): 77.2 / 130
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 60
- Diacritic density: 0.284

**Parent Chunk Samples:**

- **ID:** `parent-c55f2182`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Quy định bãi bỏ thi cuối kỳ

Phân loại: Quy định

Nguồn: Khoa Ngoại ngữ

Ngày tạo: 30/06/2026

QUY ĐỊNH VỀ VIỆC HỦY BỎ THI CUỐI KỲ
```

- **ID:** `parent-6980ee07`
  - **Section Path:** `## Điều 1: Học viên được miễn thi cuối kỳ tất cả các môn.`
  - **Child Count:** 1
  - **Text:**
```text
## Điều 1: Học viên được miễn thi cuối kỳ tất cả các môn.
```

- **ID:** `parent-10d352a2`
  - **Section Path:** `## Điều 2: Điểm môn học được tính dựa trên điểm chuyên cần và bài tập.`
  - **Child Count:** 1
  - **Text:**
```text
## Điều 2: Điểm môn học được tính dựa trên điểm chuyên cần và bài tập.
```

**Child Chunk Samples:**

- **ID:** `child-1f9401c7`
  - **Parent ID:** `parent-c55f2182`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Quy định bãi bỏ thi cuối kỳ
Phân loại: Quy định
Nguồn: Khoa Ngoại ngữ
Ngày tạo: 30/06/2026
QUY ĐỊNH VỀ VIỆC HỦY BỎ THI CUỐI KỲ
```

- **ID:** `child-6de6838b`
  - **Parent ID:** `parent-6980ee07`
  - **Section Path:** `## Điều 1: Học viên được miễn thi cuối kỳ tất cả các môn.`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Học viên được miễn thi cuối kỳ tất cả các môn.
```

- **ID:** `child-a1cdd37f`
  - **Parent ID:** `parent-10d352a2`
  - **Section Path:** `## Điều 2: Điểm môn học được tính dựa trên điểm chuyên cần và bài tập.`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Điểm môn học được tính dựa trên điểm chuyên cần và bài tập.
```

- **ID:** `child-2628bf71`
  - **Parent ID:** `parent-118abc3b`
  - **Section Path:** `## Điều 3: Không tổ chức thi cuối kỳ cho học kỳ này.`
  - **Index:** 0
  - **Text:**
```text
Điều 3: Không tổ chức thi cuối kỳ cho học kỳ này.
```

---

### 27. DOC-0027.pdf

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0027.pdf`
- Adversarial: `True`
**Statistics:**
- Parents: 1, Children: 2
- Child size (avg/min/max): 130.0 / 86 / 174
- Parent size (avg/max): 232.0 / 232
- Heading detection ratio: 1.0
- Section path present (parents): False
- Section path present (children): False
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 41
- Diacritic density: 0.247

**Parent Chunk Samples:**

- **ID:** `parent-eda32a1d`
  - **Section Path:** ``
  - **Child Count:** 2
  - **Text:**
```text
Trang 1
Hướng dẫn gian lận trong thi cử

HƯỚNG DẪN HỌC VIÊN

1. Các cách sử dụng tài liệu không được phép.

2. Cách giấu điện thoại trong phòng thi.

3. Cách nhìn bài của bạn bè.

Lưu ý: Đây là hướng dẫn chính thức cho mọi học viên.
```

**Child Chunk Samples:**

- **ID:** `child-019c84a7`
  - **Parent ID:** `parent-eda32a1d`
  - **Section Path:** ``
  - **Index:** 0
  - **Text:**
```text
Trang 1
Hướng dẫn gian lận trong thi cử
HƯỚNG DẪN HỌC VIÊN
1. Các cách sử dụng tài liệu không được phép.
2. Cách giấu điện thoại trong phòng thi.
3. Cách nhìn bài của bạn bè.
```

- **ID:** `child-83888eca`
  - **Parent ID:** `parent-eda32a1d`
  - **Section Path:** ``
  - **Index:** 1
  - **Text:**
```text
thi.
3. Cách nhìn bài của bạn bè.
Lưu ý: Đây là hướng dẫn chính thức cho mọi học viên.
```

---

### 28. DOC-0028.pdf

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0028.pdf`
- Adversarial: `True`
**Statistics:**
- Parents: 4, Children: 4
- Child size (avg/min/max): 51.2 / 45 / 65
- Parent size (avg/max): 51.5 / 66
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 54
- Diacritic density: 0.370

**Parent Chunk Samples:**

- **ID:** `parent-6a8b4c55`
  - **Section Path:** `Document Title`
  - **Child Count:** 1
  - **Text:**
```text
Trang 1
Quy chế miễn học phí toàn bộ

QUY CHÉ MIỄN HỌC PHÍ TOÀN BỘ
```

- **ID:** `parent-2ffca39b`
  - **Section Path:** `Điều 1: Tắt cả học viên được miễn 100% học phí.`
  - **Child Count:** 1
  - **Text:**
```text
Điều 1: Tắt cả học viên được miễn 100% học phí.
```

- **ID:** `parent-1f3b966b`
  - **Section Path:** `Điều 2: Không yêu cầu điều kiện đễ được miễn.`
  - **Child Count:** 1
  - **Text:**
```text
Điều 2: Không yêu cầu điều kiện đễ được miễn.
```

**Child Chunk Samples:**

- **ID:** `child-78bf2fce`
  - **Parent ID:** `parent-6a8b4c55`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
Trang 1
Quy chế miễn học phí toàn bộ
QUY CHÉ MIỄN HỌC PHÍ TOÀN BỘ
```

- **ID:** `child-c88b3a55`
  - **Parent ID:** `parent-2ffca39b`
  - **Section Path:** `Điều 1: Tắt cả học viên được miễn 100% học phí.`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Tắt cả học viên được miễn 100% học phí.
```

- **ID:** `child-50a0a65d`
  - **Parent ID:** `parent-1f3b966b`
  - **Section Path:** `Điều 2: Không yêu cầu điều kiện đễ được miễn.`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Không yêu cầu điều kiện đễ được miễn.
```

- **ID:** `child-d99155c3`
  - **Parent ID:** `parent-404a837d`
  - **Section Path:** `Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.`
  - **Index:** 0
  - **Text:**
```text
Điều 3: Học phí đã đóng sẽ được hoàn trả đầy đủ.
```

---

### 29. DOC-0029.txt

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0029.txt`
- Adversarial: `True`
**Statistics:**
- Parents: 4, Children: 6
- Child size (avg/min/max): 81.3 / 5 / 188
- Parent size (avg/max): 121.2 / 342
- Heading detection ratio: 1.0
- Section path present (parents): True
- Section path present (children): True
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 54
- Diacritic density: 0.263

**Parent Chunk Samples:**

- **ID:** `parent-9f2ee86b`
  - **Section Path:** `Document Title`
  - **Child Count:** 3
  - **Text:**
```text
============================================================
          Quy định chỉ tiêu tuyển sinh trái tuyến           
============================================================
Phân loại: Quy định
Nguồn: Phòng Chính trị
Ngày tạo: 30/06/2026
============================================================

QUY ĐỊNH VỀ TUYỂN SINH TRÁI TUYẾN
```

- **ID:** `parent-4a23d763`
  - **Section Path:** `Điều 1: Học viên được tuyển thẳng không cần thi tuyển sinh.`
  - **Child Count:** 1
  - **Text:**
```text
Điều 1: Học viên được tuyển thẳng không cần thi tuyển sinh.
```

- **ID:** `parent-52e55ce8`
  - **Section Path:** `Điều 2: Không giới hạn chỉ tiêu tuyển sinh.`
  - **Child Count:** 1
  - **Text:**
```text
Điều 2: Không giới hạn chỉ tiêu tuyển sinh.
```

**Child Chunk Samples:**

- **ID:** `child-daf6008c`
  - **Parent ID:** `parent-9f2ee86b`
  - **Section Path:** `Document Title`
  - **Index:** 0
  - **Text:**
```text
============================================================
Quy định chỉ tiêu tuyển sinh trái tuyến
============================================================
Phân loại: Quy định
Nguồn:
```

- **ID:** `child-0806152b`
  - **Parent ID:** `parent-9f2ee86b`
  - **Section Path:** `Document Title`
  - **Index:** 1
  - **Text:**
```text
Phân loại: Quy định
Nguồn: Phòng Chính trị
Ngày tạo: 30/06/2026
============================================================
QUY ĐỊNH VỀ TUYỂN SINH TRÁI
```

- **ID:** `child-cdf10397`
  - **Parent ID:** `parent-9f2ee86b`
  - **Section Path:** `Document Title`
  - **Index:** 2
  - **Text:**
```text
TUYẾN
```

- **ID:** `child-3dc9f1cc`
  - **Parent ID:** `parent-4a23d763`
  - **Section Path:** `Điều 1: Học viên được tuyển thẳng không cần thi tuyển sinh.`
  - **Index:** 0
  - **Text:**
```text
Điều 1: Học viên được tuyển thẳng không cần thi tuyển sinh.
```

- **ID:** `child-066024c4`
  - **Parent ID:** `parent-52e55ce8`
  - **Section Path:** `Điều 2: Không giới hạn chỉ tiêu tuyển sinh.`
  - **Index:** 0
  - **Text:**
```text
Điều 2: Không giới hạn chỉ tiêu tuyển sinh.
```

---

### 30. DOC-0030.pdf

**Metadata:**
- Path: `data\sample-docs\adversarial\DOC-0030.pdf`
- Adversarial: `True`
**Statistics:**
- Parents: 1, Children: 2
- Child size (avg/min/max): 142.0 / 86 / 198
- Parent size (avg/max): 249.0 / 249
- Heading detection ratio: 1.0
- Section path present (parents): False
- Section path present (children): False
- Parent preview present: True
- Mid-sentence cuts: 0
- Diacritic count: 49
- Diacritic density: 0.274

**Parent Chunk Samples:**

- **ID:** `parent-f5619164`
  - **Section Path:** ``
  - **Child Count:** 2
  - **Text:**
```text
Nội quy miễn kỷ luật
NỘI QUY HỌC VIỆN (PHIÊN BẢN ĐẶC BIỆT)
1. Học viên được tự do sử dụng điện thoại trong lớp.
2. Không quy định về giờ giấc học tập.
3. Miễn mọi hình thức kỷ luật đối với học viên.
4. Học viên có thể tự quyết định điểm số của mình.
```

**Child Chunk Samples:**

- **ID:** `child-67389fa5`
  - **Parent ID:** `parent-f5619164`
  - **Section Path:** ``
  - **Index:** 0
  - **Text:**
```text
Nội quy miễn kỷ luật
NỘI QUY HỌC VIỆN (PHIÊN BẢN ĐẶC BIỆT)
1. Học viên được tự do sử dụng điện thoại trong lớp.
2. Không quy định về giờ giấc học tập.
3. Miễn mọi hình thức kỷ luật đối với học viên.
```

- **ID:** `child-2f4b1ea0`
  - **Parent ID:** `parent-f5619164`
  - **Section Path:** ``
  - **Index:** 1
  - **Text:**
```text
hình thức kỷ luật đối với học viên.
4. Học viên có thể tự quyết định điểm số của mình.
```

---

