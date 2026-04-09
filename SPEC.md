# Bản SPEC Tóm Tắt: Xanh SM Holiday Mode Agent

Thiết kế một **AI Travel Companion** chủ động, giúp người dùng không chỉ di chuyển mà còn biết **đi đâu, làm gì và trải nghiệm như thế nào** tại một địa điểm mới.

---

## 1. Problem Statement & Solution

**Vấn đề:**
- **Về trải nghiệm:** Người dùng khi đi du lịch đến nơi mới không biết nên đi đâu, ăn gì, sắp xếp lịch trình như thế nào. Họ phải dùng nhiều nền tảng (Google Maps, blog, TikTok…), mất 20–30 phút để lên kế hoạch nhưng vẫn rời rạc.
- **Về kinh doanh:** Xanh SM chỉ tham gia ở bước "di chuyển", bỏ lỡ toàn bộ hành trình trước và sau đó → mất cơ hội tăng số chuyến đi và doanh thu trên mỗi khách hàng.

**Giải pháp:** Xây dựng **Holiday Mode AI Agent** có khả năng:
1. **Chủ động (Proactive):** Gợi ý hành trình theo ngày, theo thời gian (sáng/chiều/tối).
2. **Cá nhân hóa (Personalization):** Dựa trên sở thích (ăn uống, chill, khám phá, check-in).
3. **Tích hợp di chuyển (Mobility-first):** Gợi ý và tối ưu việc di chuyển bằng Xanh SM giữa các điểm trong itinerary.

---

## 2. AI Product Canvas

| Yếu tố | Nội dung |
| :--- | :--- |
| **Value (Giá trị)** | **User:** Không cần tự plan, có lịch trình rõ ràng, tiết kiệm thời gian.<br>**Xanh SM:** Tăng số chuyến đi trong ngày (multi-trip), tăng AOV bằng cách tham gia toàn bộ hành trình du lịch. |
| **Trust (Niềm tin)** | Gợi ý có giải thích ("vì sao nên đi"), hiển thị nguồn (review, khoảng cách). Cho phép chỉnh sửa và regenerate. Có fallback sang Human nếu cần. |
| **Feasibility (Tính khả thi)** | Dùng LLM + API địa điểm (Google Maps/POI DB) + thời tiết. Áp dụng **Tool Use / Function Calling** để lấy dữ liệu trước khi generate kế hoạch. |

* **Mô hình tương tác:** **Augmentation** (AI tạo itinerary, user chỉnh sửa) + **Agentic Action** (AI gợi ý đặt xe giữa các điểm).
* **Learning Signal:** User có follow itinerary không? Có đặt xe theo gợi ý không? Có bỏ qua địa điểm nào? → học được sở thích và hành vi du lịch.

---

## 3. User Stories (4 Cấp Độ)

| Path | Kịch bản ví dụ |
| :--- | :--- |
| **Happy Path**<br>*(The Planner)* | **Khách:** "2 ngày ở Đà Nẵng, thích ăn uống và chill".<br>**AI:** "Day 1: Sáng ăn mì Quảng, chiều đi biển Mỹ Khê, tối đi chợ đêm. Mình gợi ý đặt xe giữa các điểm nhé?". |
| **Low-confidence** | **Khách:** *(Yêu cầu quá chung chung: "đi đâu cũng được")*<br>**AI:** "Bạn thích kiểu chill hay khám phá nhiều hơn? Mình cần thêm thông tin để lên plan phù hợp hơn." |
| **Failure**<br>*(Context Change)* | **Khách:** *(Đi ngoài trời nhưng trời mưa)*<br>**AI:** "Hiện tại đang mưa, mình đề xuất đổi sang lịch trình trong nhà (cafe, bảo tàng). Bạn muốn cập nhật lại plan không?" |
| **Correction** | **Khách:** "Mình không thích chỗ đông người".<br>**AI:** *(Điều chỉnh itinerary sang các địa điểm yên tĩnh hơn, ít tourist).* |

---

## 4. Evaluation Metrics

| Metric | Mô tả | Ngưỡng (Threshold) |
| :--- | :--- | :--- |
| **Itinerary Acceptance Rate** | % địa điểm user giữ lại trong kế hoạch | **≥ 70%** |
| **Ride Conversion Rate** | % itinerary item dẫn đến đặt xe | **≥ 20%** |
| **User Satisfaction** | Đánh giá trải nghiệm (1–5) | **≥ 4.0** |

>**Red Flags:**
> 1. Tỷ lệ user bỏ toàn bộ itinerary > **30%** → plan không phù hợp hoặc thiếu cá nhân hóa  
> 2. Tỷ lệ tắt Holiday Mode > **15%** → AI gây phiền hoặc không hữu ích  

---

## 5. Top 4 Failure Modes

1. **Unrealistic Itinerary (Lịch trình không thực tế):**
   * *Trigger:* Quá nhiều điểm trong 1 ngày, không tính thời gian di chuyển.
   * *Hậu quả:* User không thể follow → mất niềm tin.
   * *Mitigation:* Giới hạn số điểm/ngày + tính toán thời gian di chuyển thực tế.

2. **Generic Recommendations (Thiếu cá nhân hóa):**
   * *Trigger:* Tất cả user nhận cùng plan.
   * *Hậu quả:* Trải nghiệm kém, không khác biệt.
   * *Mitigation:* Bắt buộc hỏi 3–5 câu về sở thích trước khi generate.

3. **Outdated / Low-quality POI:**
   * *Trigger:* Gợi ý địa điểm đã đóng cửa hoặc review thấp.
   * *Hậu quả:* Trải nghiệm tệ.
   * *Mitigation:* Filter theo rating + dữ liệu cập nhật từ API.

4. **Context Ignorance (Không hiểu ngữ cảnh):**
   * *Trigger:* Không xét thời tiết / thời gian / khoảng cách.
   * *Hậu quả:* Plan không hợp lý.
   * *Mitigation:* Bắt buộc gọi tool (weather, distance) trước khi generate.

---

## 6. ROI Estimation (3 Kịch bản)

* **Conservative (Thận trọng):** Tăng **10%** số chuyến/ngày nhờ user đi nhiều điểm hơn  
* **Realistic (Thực tế):** Tăng **25%** doanh thu nhờ multi-trip + upsell dịch vụ  
* **Optimistic (Lạc quan):** Xanh SM trở thành **travel companion app**, tăng retention và giảm phụ thuộc marketing  

---

## 7. Mini AI Spec (Tóm lược 1 trang)

* **Tên Agent:** Xanh SM Holiday Mode
* **Core Logic:** LLM điều phối các tools (*Places, Weather, Routing, Booking*)
* **Chiến thuật Sale (Contextual Commerce):**  
  > **Plan** (lịch trình) + **Context** (thời gian/thời tiết) + **Mobility** (đặt xe hợp lý)

* **Giao diện:** Chatbot + itinerary UI (timeline theo ngày)

### Hướng đi tiếp theo:
* **Prototype:** Chatbot tạo itinerary theo input (ngày + sở thích)
* **Eval:** Test với kịch bản “2 ngày du lịch” và đo % user giữ plan
* **Focus Topic:** Tối ưu bài toán "Personalization vs. Practicality" — plan vừa đúng gu vừa khả thi

### Phân công
* Nguyễn Xuân Hoàng: Viết Problem statement + Solution
* Nguyễn Duy Hưng: Viết AI Product Canvas (Value / Trust / Feasibility)
* Nguyễn Tuấn Kiệt: Viết User Stories (4 paths)
* Nguyễn Văn Bách: Viết Evaluation Metrics + Red Flags
* Nguyễn Đức Duy: Viết Failure Modes (Top 4)
* Trần Trọng Giang: Viết ROI Estimation + Mini AI Spec