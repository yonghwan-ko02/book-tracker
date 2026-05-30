# 📚 Product Requirement Document (PRD) — LuminaRead

## 1. 개요 (Introduction)
* **제품명**: LuminaRead (루미나 리드)
* **한줄 정의**: 실시간 데이터베이스 연동과 AI 취향 분석, 외부 생산성 툴(노션) 이관을 모두 아우르는 **안심 도서 검색 및 지능형 독서 습관 케어 서비스**
* **배경 및 필요성**: 
  - 시중의 독서 기록 앱들은 단순 기록에 머물러 있어 진척도 분석 및 포트폴리오 가공이 어렵습니다.
  - 외부 도서 API 서버의 잦은 유출 차단(429)이나 일시 장애 시 검색창 전체가 마비되는 문제점이 있습니다.
  - 이에 본 서비스는 다중 API 백업 우회 파이프라인으로 100% 무중단 검색을 제공하고, AI 기반의 독서 습관 추천과 노션(Notion) 마크다운/CSV 고속 내보내기를 결합하여 똑똑하고 안전한 독서 경험을 만듭니다.

---

## 2. 사용자 분석 및 페르소나 (Target Audience)
1. **PBL/프로젝트 아카이빙이 필요한 IT 개발자 및 취업준비생**
   - 자신이 읽은 서적과 기술 습득 기록을 정형화된 데이터(CSV/Markdown)로 가공하여 포트폴리오(Notion)에 즉시 연동하고 싶은 사용자.
2. **독서 습관 형성을 원하는 열정적인 독서가**
   - 연간 독서 목표를 설정하고, 매일매일 읽은 페이지 수와 한 줄 평을 기록하여 나만의 타임라인을 관리하고자 하는 사용자.
3. **가벼운 위시리스트와 실제 도서 구매를 고민하는 소비자**
   - 마음에 드는 책을 발견하면 임시 보관(장바구니)한 뒤, 국내 대형 인터넷 서점(교보문고, 알라딘)의 최저가 검색 구매 창으로 즉시 넘어가고 싶은 사용자.

---

## 3. 핵심 기능 요구사항 (Core Features)

### F1. 하이브리드 검색 및 5중 안심 도서 검색 파이프라인
* **요구사항**: 사용자 검색 시 무중단 실시간 정보 렌더링.
* **상세**:
  - **1단계 (정확도 극대화)**: 한국어 검색에 최적화된 **알라딘 OpenAPI** 실시간 호출 (`corsproxy.io` 프록시 우회 적용).
  - **2단계 (자동 대체)**: 알라딘 API 키 오류 시, **카카오 도서 검색 API**로 자동 우회.
  - **3단계 (글로벌 범용성)**: 카카오 API 한도 초과 시, **Google Books OpenAPI**로 우회.
  - **4단계 (CORS-Open 대체)**: Google API 트래픽 제한(429) 시, 즉시 **Open Library OpenAPI**로 실시간 우회 호출.
  - **5단계 (오프라인 백업)**: 모든 API 통신 단절 시, 기 탑재된 11종의 대표 베스트셀러 내장 데이터베이스(`MOCK_BOOKS`)에서 로컬 필터 검색 제공.

### F2. Supabase 기반 내 서재(Library) 및 독서 로그(Reading Logs) 관리
* **요구사항**: 개인별 도서 상태 분류 및 읽기 진척도 추적.
* **상세**:
  - **상태 관리**: '읽기 전(To Read)', '읽는 중(Reading)', '완독(Completed)' 단계적 변경.
  - **진척도 기록**: 현재 읽은 페이지 수와 전체 페이지 수를 입력하여 실시간 `%` 및 페이지 인디케이터 갱신.
  - **로그 추적**: 누적 독서량 페이지 합산 연산 및 일자별 메모 기록 타임라인 대시보드 출력.
  - **리뷰 시스템**: 완독 처리 시 5점 만점 별점 평가 및 감상평 기입.

### F3. 대시보드 통계 분석 및 Lumina AI 개인화 도서 추천
* **요구사항**: 대시보드 데이터 시각화 및 취향 분석 피드백.
* **상세**:
  - **목표 진척률**: 연간 목표 도서 설정 모달 및 목표 대비 달성률 SVG 원형 프로그레스 링 렌더링.
  - **Lumina AI 추천**: 서재 데이터를 분석하여 가장 지배적인 독서 카테고리를 추론하고 맞춤 분석 리포트 및 카테고리별 추천 도서 2~3종 렌더링. 클릭 시 원클릭 서재/장바구니 등록 연동.

### F4. 원클릭 노션 포트폴리오 & CSV 내보내기 센터
* **요구사항**: 독서 이력의 외부 오피스 툴 이관 지원.
* **상세**:
  - **노션 CSV 내보내기**: 한글이 깨지지 않도록 특수 UTF-8 BOM 인코딩(`\uFEFF`)을 주입하여 `csv` 파일로 자동 내려받기.
  - **노션 마크다운 복사**: 완독 평점 테이블 보드 및 일자별 데일리 독서 로그 전체를 깔끔한 마크다운 문법으로 번들링하여 클립보드에 복사.

### F5. 장바구니 기능 및 대형 인터넷 서점 구매 다중 연동
* **요구사항**: 위시리스트 도서 저장 및 원클릭 교보문고/알라딘 구매 창 다중 열기.
* **상세**:
  - 장바구니 리스트 렌더링 및 모의 도서 정가 합산.
  - 결제 진행 시 멀티탭 오픈 차단(보안 정책)을 우회하기 위한 **안전한 결제 연동 허브(Checkout Hub Modal)**를 제공하여 다중 도서 구매를 매끄럽게 지원.
  - 외부 연결 시 **ISBN(국제표준도서번호)** 식별자를 최우선으로 사용하여 오차 없이 정확한 도서 매핑 및 연동.

---

## 4. 기술 아키텍처 및 데이터베이스 스키마

### 1) 기술 스택
* **프론트엔드**: Vanilla HTML5, Vanilla CSS3 (Glassmorphic obsidian dark theme, HSL 토큰), Vanilla JavaScript (ES Module)
* **백엔드/데이터베이스**: Supabase Database & Auth (PostgreSQL 17)
* **빌드/서버**: Vite (고속 모듈 번들러)
* **도서 데이터**: Google Books API, Open Library API

### 2) 데이터베이스 스키마 정의 (ERD)

#### `public.books` (서재 테이블)
```sql
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    authors TEXT[] DEFAULT '{}'::TEXT[],
    publisher TEXT,
    cover_url TEXT,
    isbn TEXT,
    total_pages INTEGER DEFAULT 0,
    current_page INTEGER DEFAULT 0,
    status TEXT DEFAULT 'to_read' CHECK (status IN ('to_read', 'reading', 'completed')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    purchase_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
```

#### `public.reading_logs` (독서 일지 테이블)
```sql
CREATE TABLE public.reading_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    pages_read INTEGER NOT NULL,
    notes TEXT,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
```

#### `public.cart_items` (장바구니 테이블)
```sql
CREATE TABLE public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    authors TEXT[] DEFAULT '{}'::TEXT[],
    cover_url TEXT,
    isbn TEXT,
    purchase_url TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
```
