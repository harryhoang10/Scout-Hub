# ScoutHub v3.0 — Execution Hub & Enhancement Plan (Revised)

Kế hoạch triển khai toàn diện để nâng cấp ScoutHub từ một **công cụ lưu trữ & scouting profiles** thành một **nền tảng quản lý end-to-end quy trình KOL Execution**.

> [!NOTE]
> **Triết lý thiết kế xuyên suốt:**
> - **Auto-status:** Status tự động cập nhật dựa trên dữ liệu được fill. Hạn chế thao tác thủ công tối đa.
> - **Smart transitions:** Khi điền đủ thông tin của 1 phase → tự chuyển sang phase tiếp theo. User vẫn có thể override thủ công nếu cần.
> - **Lean UI:** Giao diện tối giản, user-friendly, không gây rối mắt dù đầy đủ chức năng.
> - **Không phá vỡ:** Mọi enhancement đều an toàn, không ảnh hưởng chức năng hiện có.

---

## PHẦN A: ROOM TO ENHANCE — Tối ưu phiên bản hiện tại

### A1. Cột Zalo Quick-Contact trong CRM

#### [MODIFY] [ScoutCRM.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/ScoutCRM.tsx)
#### [MODIFY] [ProfileDrawer.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/ProfileDrawer.tsx)

**Mục tiêu:** Với profile nào có SĐT → tự động sinh link `zalo.me/{số_điện_thoại}`. Click vào sẽ mở app Zalo trực tiếp, tiện nhắn tin nhanh.

**Chi tiết:**
- Thêm cột **Zalo** trong bảng CRM, nằm cạnh cột SĐT
- Format link: `https://zalo.me/{phone}` (chuẩn hoá SĐT trước khi tạo link: bỏ dấu +84, giữ format 0xxx)
- Hiển thị: Icon Zalo nhỏ + "Chat" — khi click → `window.open('https://zalo.me/0xxxxxxxxx', '_blank')`
- Nếu profile không có SĐT → ẩn cột, hiển thị `—`
- Trong ProfileDrawer → thêm nút "💬 Zalo" cạnh SĐT ở phần Thông tin liên hệ

---

### A2. Nút Ẩn/Hiện Số Điện Thoại trong CRM

#### [MODIFY] [ScoutCRM.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/ScoutCRM.tsx)

**Vấn đề hiện tại:** Cột SĐT chỉ hiển thị icon Phone nhỏ, phải hover mới thấy. Muốn gọi phải copy thủ công.

**Giải pháp:**
- Thêm toggle button ở header cột SĐT: 👁 ẩn/hiện
- **Chế độ ẩn (mặc định):** Hiện icon Phone + "•••••" (bảo mật, gọn bảng)
- **Chế độ hiện:** Hiện full SĐT dạng text (`0912 345 678`) + nút **Copy** nhỏ bên cạnh (click → copy vào clipboard)
- Áp dụng toggle chung cho toàn bộ bảng (1 nút toggle → tất cả dòng ẩn/hiện cùng lúc)
- Lưu preference vào `localStorage` để nhớ lần sau

---

### A3. Đồng bộ AI Model cho Extractors

#### [MODIFY] [FacebookExtractor.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/FacebookExtractor.tsx#L130)
#### [MODIFY] [Extractor.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/Extractor.tsx#L124)

- 2 file này đang hardcode `model: "gemini-3-flash-preview"` thay vì đọc từ `localStorage('scout_hub_ai_model')`.
- Fix: Thay bằng `localStorage.getItem('scout_hub_ai_model') || 'gemini-2.5-flash'` — thống nhất toàn app.

---

### A4. Hướng dẫn đổi AI Model & Provider trong Settings

#### [MODIFY] [App.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/App.tsx#L810-L867)

**Vấn đề:** Hướng dẫn trong phần Gemini Guide hiện tại chỉ đề cập `gemini-2.5-flash` và `gemini-2.5-pro`. Người dùng không biết có thể dùng model khác, hoặc kết nối provider khác (OpenRouter, Groq, ...).

**Nội dung bổ sung vào Gemini Guide collapsible:**

**Bảng Model khuyên dùng:**

| Model | Tốc độ | Chất lượng | Free Tier | Ghi chú |
|-------|--------|-----------|-----------|---------|
| `gemini-2.5-flash` | ⚡⚡⚡ | ★★★ | ✅ Không giới hạn | **Mặc định.** Tốt cho cào profile, phân loại nhanh |
| `gemini-2.5-pro` | ⚡⚡ | ★★★★★ | ✅ 25 req/ngày | Tốt cho soạn email, parse báo giá phức tạp |
| `gemini-2.0-flash` | ⚡⚡⚡ | ★★★ | ✅ Không giới hạn | Backup nếu 2.5-flash quá tải |

**Hướng dẫn đổi sang provider khác (OpenRouter, Groq, v.v.):**
- Bước 1: Đăng ký tài khoản tại provider (VD: openrouter.ai)
- Bước 2: Lấy API Key từ provider
- Bước 3: Đổi **AI Base URL** sang endpoint của provider (VD: `https://openrouter.ai/api/v1/`)
- Bước 4: Đổi **AI Model Name** sang model của provider (VD: `google/gemini-2.5-pro-preview`)
- Bước 5: Dán API Key của provider vào trường **Gemini API Key** (dù tên gọi là Gemini nhưng hệ thống tương thích OpenAI format)

**Lưu ý quan trọng:** ScoutHub sử dụng chuẩn OpenAI-compatible API, nên bất kỳ provider nào hỗ trợ endpoint `/chat/completions` đều có thể dùng được.

---

### A5. UX & Performance Improvements

#### [MODIFY] [ScoutCRM.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/ScoutCRM.tsx)
#### [NEW] [Toast.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/ui/Toast.tsx)
#### [MODIFY] [App.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/App.tsx)

- **Toast notification:** Tạo component Toast nhẹ thay thế ~15 chỗ `alert()` trong app. Không block UI, tự biến mất sau 3s.
- **Debounced save:** `localStorage.setItem` hiện trigger mỗi keystroke → debounce 500ms để giảm I/O.
- **Lazy load modals:** OutreachComposer (62KB), QuotationParser (27KB), KPIDashboardModal (17KB) → `React.lazy` + `Suspense` để không load khi không cần.

---

## PHẦN B: EXECUTION HUB — Module quản lý triển khai KOL

### B0. Nguyên tắc thiết kế Execution Hub — Auto-Status Engine

> [!IMPORTANT]
> **Auto-Status Engine — Hạn chế sức người tối đa:**
> - Status tự động cập nhật khi user fill/thay đổi dữ liệu. User **KHÔNG** cần thủ công chuyển status.
> - Khi hoàn thành phase hiện tại → tự động chuyển profile sang phase tiếp theo.
> - User vẫn có thể **override thủ công** bất cứ lúc nào qua dropdown (phòng trường hợp đặc biệt).

> [!TIP]
> **Bảng quy tắc Auto-Status:**
>
> **🔗 CONNECTING:**
> | Trigger (khi user fill/thay đổi) | → Auto-set status |
> |---|---|
> | Profile mới được thêm vào campaign | → `Chờ báo giá` |
> | Có ≥1 SOW item được nhập | → `Đang deal` |
> | Có SOW + totalCost + paymentTerm đã fill | → `Đã confirm` |
> | Khi status = `Đã confirm` | → **Tự chuyển sang cột Launching** (status = `Chuẩn bị`) |
>
> **🚀 LAUNCHING:**
> | Trigger | → Auto-set status |
> |---|---|
> | Vừa chuyển từ Connecting sang | → `Chuẩn bị` |
> | contractType được chọn HOẶC confirmEmailDraft được lưu | → `Đang thực hiện` |
> | Có ≥1 publishedLink được thêm | → `Đã air` |
> | Khi status = `Đã air` | → **Tự chuyển sang cột Wrapping** (status = `Chờ đi tiền`) |
>
> **✅ WRAPPING:**
> | Trigger | → Auto-set status |
> |---|---|
> | Vừa chuyển từ Launching sang | → `Chờ đi tiền` |
> | invoiceNumber được nhập | → `Đang xử lý` |
> | actualPaymentDate được fill | → `Hoàn thành` |
>
> **Huỷ:** Chỉ set thủ công (user chủ động huỷ profile khỏi campaign).
>
> **Override:** Mọi status đều có thể chỉnh tay qua dropdown chip trên card — auto-engine chỉ chạy khi data thay đổi, không ghi đè nếu user đã override.

---

### B1. Data Model

#### [MODIFY] [types.ts](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/types.ts) — Bổ sung types

```typescript
// === EXECUTION HUB TYPES ===

export type ExecutionPhase = 'connecting' | 'launching' | 'wrapping';

// Lean status — mỗi phase chỉ 3-4 options
export type ConnectingStatus = 'pending_quote' | 'dealing' | 'confirmed' | 'cancelled';
export type LaunchingStatus = 'preparing' | 'in_progress' | 'aired' | 'cancelled';
export type WrappingStatus = 'pending_payment' | 'processing' | 'completed' | 'cancelled';

export interface Campaign {
  id: string;
  name: string;
  chargeCode: string;
  brand: string;
  description: string;
  startDate: string;
  endDate: string;
  budget?: number;
  status: 'draft' | 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionProfile {
  id: string;
  campaignId: string;
  profileId: string;              // Reference → RestoredData.id
  phase: ExecutionPhase;

  // --- CONNECTING ---
  connectingStatus: ConnectingStatus;
  confirmedSOW: SOWItem[];
  totalCost: number;
  currency: string;               // 'VND' | 'USD'
  paymentTerm: string;            // "Net 30", "COD", "50/50"
  confirmMessageRaw: string;      // Tin nhắn gốc confirm

  // --- LAUNCHING ---
  launchingStatus: LaunchingStatus;
  contractType: 'individual' | 'company' | 'business_household';
  contractNotes: string;          // Ghi chú hợp đồng tự do
  contractGoogleDocUrl?: string;
  confirmEmailDraft?: string;
  contentDeadline?: string;
  publishedLinks: string[];

  // --- WRAPPING ---
  wrappingStatus: WrappingStatus;
  expectedPaymentDate?: string;
  actualPaymentDate?: string;
  invoiceNumber?: string;
  acceptanceNotes: string;        // Ghi chú nghiệm thu
  followUpItems: FollowUpItem[];

  // --- META ---
  notes: string;                  // Ghi chú tự do chung
  assignedAt: string;
  updatedAt: string;
}

export interface SOWItem {
  name: string;
  price: number;
  currency: string;
  quantity: number;
}

export interface FollowUpItem {
  id: string;
  description: string;
  dueDate: string;
  completed: boolean;
}
```

---

### B2. Navigation — Thêm tab Execution Hub

#### [MODIFY] [App.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/App.tsx)

- Thêm tab `execution` vào sidebar, icon `Rocket` từ lucide-react
- State: `campaigns: Campaign[]` + `executionProfiles: ExecutionProfile[]` → persist `localStorage`
- Khi chưa có campaign nào → landing page hiện empty state + CTA tạo campaign đầu tiên

---

### B3. Campaign Manager

#### [NEW] [CampaignManager.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/execution/CampaignManager.tsx)

**Landing Page — Danh sách campaigns:**

```
┌──────────────────────────────────────────────────┐
│  🚀 Execution Hub              [+ Tạo Campaign]  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────┐  ┌────────────────┐          │
│  │ Tết Nguyên Đán │  │ Summer Promo   │          │
│  │ CC: MKT-2026Q1 │  │ CC: MKT-2026Q2 │          │
│  │ Brand: ABC     │  │ Brand: XYZ     │          │
│  │                │  │                │          │
│  │ 🔗 3  🚀 5  ✅ 2│  │ 🔗 1  🚀 2  ✅ 0│          │
│  │ ████████░░ 70% │  │ ███░░░░░ 33%  │          │
│  │ Active         │  │ Draft          │          │
│  └────────────────┘  └────────────────┘          │
│                                                  │
└──────────────────────────────────────────────────┘
```

- Campaign card: Tên, Charge Code (editable inline), Brand, mini progress 3 phases
- Modal tạo campaign: Tên, Charge Code, Brand, Mô tả, Timeline, Budget (optional)
- **Thêm profiles:** Dialog chọn từ CRM — hiện tất cả profiles (không filter theo workflow status, để user tự quyết)
- Click vào campaign → drill-down vào Kanban Board

---

### B4. Execution Kanban Board

#### [NEW] [ExecutionKanban.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/execution/ExecutionKanban.tsx)

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back   Campaign: Tết Nguyên Đán   CC: MKT-2026Q1   Budget: 50M  │
├──────────────────┬──────────────────┬──────────────────┬────────────┤
│  🔗 CONNECTING   │  🚀 LAUNCHING    │  ✅ WRAPPING     │ 📅 Timeline│
│  (3 profiles)    │  (5 profiles)    │  (2 profiles)    │            │
│                  │                  │                  │            │
│ ┌──────────────┐ │ ┌──────────────┐ │ ┌──────────────┐ │ Hôm nay    │
│ │ @username1   │ │ │ @username4   │ │ │ @username9   │ │ ● Content  │
│ │ Video 5tr    │ │ │ Photo+Video  │ │ │ 15M          │ │   deadline │
│ │ [Chờ báo giá]│ │ │ 12M          │ │ │ [Chờ đi tiền]│ │   user4    │
│ │ 💬 📧        │ │ │ [Đang thực   │ │ │ 💰 01/03     │ │            │
│ └──────────────┘ │ │  hiện]       │ │ └──────────────┘ │ 05/03      │
│                  │ │ 📄 HĐ: Đã ký│ │                  │ 🔴 Payment │
│ ┌──────────────┐ │ └──────────────┘ │ ┌──────────────┐ │   overdue  │
│ │ @username2   │ │                  │ │ @username10  │ │   user9    │
│ │ SDHA 2tr     │ │ ┌──────────────┐ │ │ 8M           │ │            │
│ │ [Đã confirm] │ │ │ @username5   │ │ │ [Hoàn thành] │ │ 10/03      │
│ │ ✅ → kéo qua │ │ │ Livestream   │ │ │ ✅ Đã đi tiền│ │ 🟢 Content │
│ └──────────────┘ │ │ 20M          │ │ └──────────────┘ │   user5    │
│                  │ │ [Chuẩn bị]   │ │                  │            │
│                  │ └──────────────┘ │                  │            │
└──────────────────┴──────────────────┴──────────────────┴────────────┘
```

**3 cột Kanban — Auto-status, lean:**

| Phase | Statuses (auto-set) | Trigger tự động |
|-------|---------------------|------------------|
| 🔗 Connecting | `Chờ báo giá` → `Đang deal` → `Đã confirm` | SOW nhập → dealing · SOW+giá+PT đủ → confirmed → **auto chuyển Launching** |
| 🚀 Launching | `Chuẩn bị` → `Đang thực hiện` → `Đã air` | Chọn contract type hoặc lưu email draft → in_progress · Thêm link bài → aired → **auto chuyển Wrapping** |
| ✅ Wrapping | `Chờ đi tiền` → `Đang xử lý` → `Hoàn thành` | Nhập invoice → processing · Fill ngày đi tiền thực tế → completed |
| Mọi phase | `Huỷ` | Chỉ set thủ công |

**Profile Card trên board:**
- Avatar + Tên (@handle)
- SOW tóm tắt + Tổng chi phí
- Status chip (auto-update, có thể override thủ công qua dropdown nếu cần)
- Quick action icons: 💬 Soạn tin nhắn · 📧 Soạn email · 📄 Tạo HĐ
- Click card → mở **Execution Detail Panel** (slide-in từ bên phải)

**Kéo thả + Auto-move:**
- Auto-move: Khi status chạm trạng thái cuối của phase (VD: `Đã confirm` ở Connecting) → profile tự bay sang cột tiếp theo với animation mượt
- Manual drag-drop vẫn hỗ trợ: User vẫn có thể kéo profile giữa columns nếu muốn can thiệp
- Khi profile vào cột mới (dù auto hay manual) → status reset về trạng thái đầu tiên của cột đó

**Execution Detail Panel** (khi click vào profile card):
- Tab-based layout giống ProfileDrawer hiện tại:
  - **Tab Tổng quan:** SOW, chi phí, payment term, status hiện tại (auto-updated), ghi chú
  - **Tab Paperwork:** Contract type (Cá nhân/Công ty/Hộ KD), contract notes, Google Doc link, email confirm draft
  - **Tab Wrapping:** Payment tracking, invoice, ngày đi tiền, biên bản nghiệm thu notes
  - **Tab Follow-up:** Checklist các mục cần follow-up (thêm/xoá/tick hoàn thành, set ngày deadline)
- Tất cả trường đều editable inline, lưu khi blur/enter → **mỗi lần save sẽ trigger auto-status engine check**

---

### B5. AI SOW Confirm Email Generator

#### [NEW] [SOWConfirmEmail.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/execution/SOWConfirmEmail.tsx)

Modal mở từ nút 📧 trên profile card hoặc trong detail panel:

**Input (auto-fill từ execution data):**
- Tên KOL, Platform, SĐT/Email
- SOW items đã confirm + tổng chi phí
- Payment Term
- **Hình thức ký:** Radio — `Ký cá nhân` / `Ký công ty` / `Ký hộ kinh doanh`
- Ghi chú bổ sung (textarea)

**AI Output:**
- Email xác nhận SOW chuyên nghiệp, đầy đủ thông tin
- Preview text → nút **Copy** + nút **Lưu draft** (lưu vào `confirmEmailDraft` trong execution profile)
- User tự gửi email qua Gmail/Outlook (app không gửi email thay user)

---

### B6. AI Contract Generator (Framework)

#### [NEW] [ContractGenerator.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/execution/ContractGenerator.tsx)

> [!IMPORTANT]
> Tính năng này cần input thêm từ bạn về template hợp đồng mẫu. Dưới đây là khung thiết kế sẵn sàng triển khai.

**Luồng:**
1. **Paste/Upload template HĐ mẫu** (plain text hoặc `.txt`)
2. **AI scan & highlight trường cần điền** — liệt kê ra form: Tên KOL, CMND, địa chỉ, MST, SOW, giá, timeline...
3. **Auto-fill** trường có sẵn từ CRM + Execution data
4. **User bổ sung** trường còn thiếu (CMND, địa chỉ, MST...)
5. **AI hoàn thiện** — rà soát toàn bộ, chỉnh format nhất quán
6. **Export:** Copy text hoàn chỉnh / Download `.txt` (Google Docs API integration = phase sau)

---

### B7. Execution Timeline Sidebar

#### [NEW] [ExecutionTimeline.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/execution/ExecutionTimeline.tsx)

Panel bên phải của Kanban Board (co lại/mở rộng được):

**Hiển thị timeline dọc theo ngày, color-coded:**
- 🔴 **Overdue** — đã quá hạn (payment, content deadline)
- 🟡 **Sắp đến** — trong 3 ngày tới
- 🟢 **Bình thường** — deadline xa
- ⚪ **Hoàn thành** — đã xong, mờ đi

**Loại events:**
- 📅 Content deadline: `@user4 — Deadline nộp content 01/03`
- 💰 Ngày đi tiền: `@user9 — Payment dự kiến 05/03`
- 📝 Follow-up: `@user5 — Gửi biên bản nghiệm thu`

**In-app Notification:**
- Badge số đỏ trên icon Execution Hub ở sidebar (VD: "3" = 3 items overdue/sắp đến)
- Khi mở Execution Hub → popup nhẹ "⏰ Bạn có 3 mục cần attention hôm nay" (dismiss 1 click, không phiền)
- KHÔNG gửi email. Chỉ notification trong app.

---

### B8. AI Message Templates cho Connecting

#### [NEW] [ConnectingMessages.tsx](file:///Users/hoangtan/Documents/AI%20Project/tiktok-profile-extractor/src/components/execution/ConnectingMessages.tsx)

Reuse AI engine từ OutreachComposer, với template set riêng:

| Template | Mục đích |
|----------|----------|
| Hỏi báo giá | "Bạn ơi giá cho [SOW cụ thể] bên mình đang cần là bao nhiêu ạ?" |
| Hỏi Payment Term | "Bên mình muốn check thêm về điều khoản thanh toán..." |
| Counter-offer | "Bên mình note giá [X], anh/chị xem lại giúp em..." |
| Confirm SOW + Chi phí | "Em confirm lại SOW và tổng chi phí như sau..." |

- AI adapt theo từng profile (tên, platform, followers, niche)
- Reuse conversation samples từ OutreachComposer nếu đã train
- Output: Text preview → Copy → User tự gửi

---

### B9. Brainstorm bổ sung — 5 initiatives tăng giá trị

#### Initiative 1: Campaign Budget Tracker
- Thanh progress: `Đã commit: 35M / Budget: 50M (70%)`
- Cảnh báo nếu vượt budget (badge vàng/đỏ)
- Hiển thị trên campaign card + campaign header

#### Initiative 2: Execution Export / Campaign Report
- Xuất Excel cho mỗi campaign: danh sách KOL, SOW, giá, status HĐ, status tiền, links bài air
- Dùng cho báo cáo team/client

#### Initiative 3: Profile Activity Log
- Trong Execution Detail Panel → tab "Lịch sử" ghi lại mọi thao tác: "Chuyển Connecting → Launching", "Lưu email confirm draft", "Cập nhật payment status"
- Tự động ghi, không cần user input

#### Initiative 4: CRM ↔ Execution Quick Link
- Trong ScoutCRM, profile đang nằm trong Execution → hiện badge: `"🚀 Tết Nguyên Đán — Launching"`
- Click badge → nhảy thẳng tới Execution Hub, mở đúng campaign đó

#### Initiative 5: Duplicate Execution Guard
- Khi thêm profile vào campaign → check nếu profile đang active trong campaign khác
- Hiện cảnh báo: `"⚠ @username đang ở phase Launching trong campaign [Tết Nguyên Đán]. Vẫn thêm?"`
- User tự quyết có thêm hay không (chỉ cảnh báo, không block)

---

## Kế hoạch triển khai theo Phase

### Phase 1: Quick Wins & Foundation (1-2 ngày)
- [ ] A1: Cột Zalo quick-contact
- [ ] A2: Toggle ẩn/hiện SĐT
- [ ] A3: Fix hardcode AI model
- [ ] A4: Bổ sung hướng dẫn đổi model/provider trong Settings
- [ ] A5: Toast notification + debounced save
- [ ] B1: Data model mới trong `types.ts`
- [ ] B2: Tab Execution Hub trong sidebar + state management

### Phase 2: Execution Hub Core (3-5 ngày)
- [ ] B3: Campaign Manager (CRUD, charge code, chọn profiles)
- [ ] B4: Kanban Board 3 cột (auto-status engine, drag-drop phase, detail panel)
- [ ] B7: Timeline sidebar
- [ ] B9.1: Budget Tracker
- [ ] B9.5: Duplicate Guard
- [ ] B9.4: CRM ↔ Execution quick link

### Phase 3: AI Features (2-3 ngày)
- [ ] B5: SOW Confirm Email Generator
- [ ] B8: AI Message Templates Connecting
- [ ] B9.3: Profile Activity Log

### Phase 4: Contract & Advanced (2-3 ngày)
- [ ] B6: Contract Generator framework
- [ ] B9.2: Export Campaign Report
- [ ] Smart notification badge

### Phase 5: Polish
- [ ] Lazy load modals (OutreachComposer, QuotationParser)
- [ ] Responsive mobile cho Execution Hub
- [ ] Final UX review & performance audit

---

## Open Questions

> [!IMPORTANT]
> **Về Contract Generator (B6):**
> 1. Bạn có sẵn file hợp đồng mẫu ở dạng nào? (Word .docx, Google Docs, PDF, hay text thuần?)
> 2. Output mong muốn: Copy text thuần, download `.txt`, hay cần tạo Google Docs tự động?
> 3. Tích hợp Google Docs API ngay hay để phase sau?

> [!IMPORTANT]
> **Về Budget & Tiền:**
> 1. Budget campaign nhập VND hay cần hỗ trợ USD?
> 2. Payment nhiều đợt (50/50, 30/40/30) cần track chi tiết từng đợt hay chỉ 1 mốc?

> [!IMPORTANT]
> **Về Notification:**
> Notification trong app (badge + popup nhẹ) là đủ hay muốn thêm kênh khác?

> [!IMPORTANT]
> **Về Priority:**
> Bạn muốn bắt đầu Phase nào trước? Recommend: Phase 1 → Phase 2 để có khung Execution Hub chạy được, rồi bổ sung AI features Phase 3-4 sau.

---

## Verification Plan

### Automated Tests
- `npm run build` phải pass không lỗi TypeScript
- `npm run dev` → navigate tất cả tabs, không crash

### Manual Verification
- A1: Click Zalo link → mở app Zalo với đúng SĐT
- A2: Toggle SĐT → ẩn/hiện đúng, refresh vẫn nhớ preference
- A3: Đổi model trong Settings → Extractor dùng đúng model mới
- A4: Đọc hướng dẫn mới trong Settings → hiểu cách đổi model/provider
- B3: Tạo campaign → thêm profiles → thấy trên Kanban
- B4: Fill SOW+giá+PT → status tự chuyển `Đã confirm` → profile auto-move sang Launching. Override thủ công vẫn hoạt động.
- B5: Generate email confirm SOW → nội dung đầy đủ thông tin
- B7: Thêm deadline → hiện trên timeline → badge notification đếm đúng
