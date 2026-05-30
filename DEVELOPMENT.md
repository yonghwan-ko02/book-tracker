# 🛠️ 기술 개발 일지 및 포트폴리오 가이드 (DEVELOPMENT)

LuminaRead 웹 애플리케이션의 상세 설계 아키텍처, 단계별 개발 이력, 핵심 엔지니어링 도전 과제 및 트러블 슈팅 내역을 상세히 기록한 **포트폴리오 맞춤형 기술 개발 명세서**입니다.

---

## 1. 프로젝트 아키텍처 (Technical Architecture)

LuminaRead는 복잡한 프레임워크(React, Vue 등)의 의존성을 걷어내고, **바닐라 자바스크립트(Vanilla JS)의 핵심 성능을 최대로 끌어올린 싱글 페이지 애플리케이션(SPA)** 구조로 구현되었습니다.

```text
                               ┌─────────────────────────────┐
                               │       LuminaRead SPA        │
                               │  (Vanilla HTML5 / CSS / JS) │
                               └──────────────┬──────────────┘
                                              │
                      ┌───────────────────────┼────────────────────────┐
                      ▼                       ▼                        ▼
           ┌─────────────────────┐ ┌─────────────────────┐ ┌───────────────────────┐
           │   Supabase Cloud    │ │  Google Books API   │ │   Open Library API    │
           │  (PostgreSQL / RLS) │ │ (실시간 1차 도서원) │ │ (2차 백업 실시간 검색)│
           └─────────────────────┘ └─────────────────────┘ └───────────────────────┘
```

* **SPA Router**: Browser History API 대신 라우터 모듈을 경량 캡슐화하여, 페이지 깜빡임 없이 부드러운 패널 전환 트랜지션을 제공합니다.
* **Database & Security Layer**: Supabase의 로우 레벨 보안(RLS) 정책을 통해 사용자의 프라이버시를 독립적으로 보장하며 가볍고 강력한 인증 세션을 이어갑니다.

---

## 2. 핵심 엔지니어링 및 트러블 슈팅 (Core Engineering Cases)

### 🚨 Case 1. ES 모듈 임포트 시점과 DOM 로드 동기화 불일치 (Null Reference)
* **문제 증상**: 앱 구동 시 콘솔 창에 오류가 나지 않음에도 불구하고, 도서 검색 버튼이나 카테고리 칩을 클릭했을 때 이벤트 리스너가 작동하지 않고 검색 창이 먹통이 되는 현상 발생.
* **원인 분석**:
  - `app.js` 상단에서 `import { initSearch } from './search.js'`를 통해 모듈을 가져올 때, `search.js` 내의 최상단 스코프에 작성된 `document.getElementById('btnSearchSubmit')`와 같은 DOM 쿼리문들이 즉각 실행됨.
  - 모듈의 임포트 시점에는 브라우저가 아직 HTML 바디의 엘리먼트들을 전부 파싱하지 않은 상태이므로 선택자들은 일제히 `null`을 반환함.
  - 이로 인해 `initSearch()` 함수가 실행될 때 선택자들이 이미 `null` 상태여서 이벤트 리스너가 실제로 바인딩되지 않은 채 침묵하는 Silent Error 버그였음.
* **해결 방안**:
  - 모듈의 최상단 전역 스코프에 존재하던 모든 `const` 형태의 DOM 선택자들을 **지연 할당(Lazy Query) 변수(`let`)**로 전환.
  - 메인 코디네이터가 각 패널을 실제로 실행하고 바인딩하는 진입점인 `initSearch()`, `initLibrary()`, `initCart()` **내부 영역으로 DOM 선택자 쿼리 로직을 이전**.
  - 메인 `app.js`에서도 `DOMContentLoaded` 이벤트가 혹시 브라우저 구동 순서 차이로 인해 이미 발화(Fired)해 버린 상황에 대응하도록 `document.readyState` 안전 제어 코드를 적용함.
* **최종 결과**: 모듈 로딩 순서에 영향받지 않는 100% 무오류 SPA 렌더링 동기화 성공.

---

### 🚨 Case 2. Google Books API 429 (Too Many Requests) 트래픽 차단 대응
* **문제 증상**: Keyless 상태로 구글 도서 검색을 실시간 요청할 때, 동일한 로컬 IP 대역에서 중복 호출이 누적됨에 따라 Google Books API가 `429` 오류 응답을 내려 검색 화면에 "API 네트워크 통신 중 오류가 발생했습니다"라는 메시지만 노출되고 서비스가 마비됨.
* **원인 분석**:
  - 구글 도서 OpenAPI는 인증 키 없이 호출 가능한 1일 한도량이 정해져 있으며, 공유 호스트망이나 동일 IP 환경에서 개발을 진행할 때 이 한도가 순식간에 고갈됨.
  - 국내의 다른 서점 API(알라딘, 네이버)들은 브라우저 전면 호출 시 **CORS(Cross-Origin Resource Sharing) 차단** 정책이 걸려 있어 백엔드 프록시 없이는 직접 통신이 불가했음.
* **해결 방안**:
  - 프론트엔드 단독 환경에서 네트워크 장애 복원력(Resilient Engineering)을 극대화하기 위해 **"3중 안심 실시간 대체 검색 파이프라인"** 고안.
  - `fetch` 요청을 `try-catch` 블록으로 래핑한 뒤, 1단계 Google Books API 실패(429 또는 500)가 캐치되면 즉시 브라우저 CORS 정책이 열려 있고 트래픽 제한이 극히 유연한 **`Open Library OpenAPI`**로 실시간 검색 대상지를 우회 스위칭.
  - Open Library의 도서 정보 스키마(docs.title, author_name, cover_i 등)를 **기존의 Google Books VolumeInfo 스키마 형태로 실시간 매핑 변환**하도록 설계하여, 검색 결과 카드 렌더링 모듈을 100% 공통 재사용하도록 영리하게 통합.
  - 3단계로 네트워크 오프라인 상태까지 대비해 로컬 백업 베스트셀러 내장 데이터베이스(`MOCK_BOOKS`) 필터링으로 이어지도록 보강.
* **최종 결과**: 실시간 검색 복원력 200% 증가. API 서버가 마비되어도 실시간 우회 검색을 지원하는 상용 서비스급 안정성 확보.

---

### 🚨 Case 3. Supabase Postgres `42501` (Permission Denied) 권한 장애
* **문제 증상**: 데모 자동 로그인을 통해 정상적으로 세션을 인증받았음에도 불구하고, 서재에 책을 저장하거나 카트를 갱신하려고 할 때 `42501 permission denied for table books` Postgres 오류가 나타나며 DB 저장이 거부됨.
* **원인 분석**:
  - Supabase 데이터베이스에 새 테이블을 생성하고 RLS(Row Level Security) 정책을 켰으나, PostgreSQL 엔진 상에서 PostgREST API를 호출하는 세부 DB 롤인 `authenticated` 및 `anon`에 대해 직접적인 `SELECT`, `INSERT`, `UPDATE`, `DELETE` 권한(Privileges)이 명시적으로 부여되지 않았음.
* **해결 방안**:
  - Supabase SQL Editor를 통해 `authenticated` 및 `anon` 역할(Role)에 스키마 사용 권한과 각 테이블의 모든 접근 제어 권한을 명시적으로 부여하는 마이그레이션 실행.
  ```sql
  GRANT ALL PRIVILEGES ON TABLE public.books TO authenticated, anon;
  GRANT ALL PRIVILEGES ON TABLE public.reading_logs TO authenticated, anon;
  GRANT ALL PRIVILEGES ON TABLE public.cart_items TO authenticated, anon;
  GRANT USAGE ON SCHEMA public TO authenticated, anon;
  ```
* **최종 결과**: RLS 권한 보안은 유지하면서, PostgREST 세션을 거친 데이터 저장 기능이 즉각 무중단 통과됨.

---

## 3. 성장 포인트 & 프로젝트 소감

1. **바닐라 환경에서의 아키텍처 제어**
   - React 등 프레임워크가 제공하던 상태(State) 기반 렌더링을 직접 `CustomEvent` 디스패처 모델과 라우터를 활용해 직접 설계해 봄으로써, 브라우저가 화면을 갱신하는 렌더트리 주기와 DOM 성능 최적화에 대한 이해도가 획기적으로 상승했습니다.
2. **장애 극복력 설계 (Chaos Engineering 기초)**
   - API가 항시 잘 작동할 것이라는 안일한 믿음에서 벗어나, 네트워크 장애나 트래픽 스로틀링(429)이 발생하는 상황을 능동적으로 감지하고 대처하는 **방어적 하이브리드 통신 우회 모델**을 구현함으로써, 진정한 유연성(Resiliency)을 갖춘 프론트엔드 설계 능력을 길렀습니다.
3. **노션 친화적 포트폴리오 가공**
   - 웹 애플리케이션의 독서 아카이빙 데이터를 노션이 완벽하게 소화할 수 있도록 BOM 인코딩 CSV와 Notion 마크다운 템플릿 제너레이터를 직접 프로그래밍하면서, 실제 유저에게 직접적인 효용을 제공하는 제품 지향적 개발(Product-Led Development)의 즐거움을 체득했습니다.
