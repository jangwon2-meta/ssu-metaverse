# 숭실대학교 가상융합대학원 홈페이지

GitHub Pages로 운영하는 정적 홈페이지입니다. 공지사항·뉴스는 **구글 문서 하나**로 관리합니다.

## 페이지 구성

| 메뉴 | 파일 |
|---|---|
| Home | `index.html` |
| About — 학과 소개 / 연구 분야 / 전공·학위 과정 | `about.html` · `research.html` · `majors.html` |
| Education — 입학 안내 / 커리큘럼 | `education.html` · `curriculum.html` |
| People — 교수진 / 연구원 | `people.html` · `researchers.html` |
| Notice · News | `notice.html` · `news.html` |
| Faculty — 시설·공간 / 장비 | `facilities.html` · `equipment.html` |

## 공지·뉴스 올리기 (구글 문서)

1. 관리용 구글 문서를 엽니다 (`site.config.json`의 `googleDoc`에 적힌 문서).
2. `=== 공지 ===` 또는 `=== 뉴스 ===` 아래에 다음 형식으로 씁니다. 글과 글 사이는 `---` 한 줄.

   ```
   날짜: 2026-10-01
   제목: 2027학년도 전기 모집 요강 공고
   카테고리: 입학
   고정: 예            (선택 — 맨 위 고정)
   링크: https://...   (선택 — '관련 링크 열기' 버튼)
   이미지:             (선택 — 다음 줄에 사진 붙여넣기, 뉴스 대표 사진)
   본문:
   여기부터 본문. 사진과 링크도 넣을 수 있습니다.
   ---
   ```
3. 15분 안에 자동 반영됩니다. 바로 반영하려면 **Actions → "사이트 배포" → Run workflow**.

- 숨기기: `공개: 아니오` · 영어 제목: `영문제목:`
- 버튼 링크(모집요강 PDF 등)는 `=== 설정 ===`에서 바꿉니다.
- 교수 사진은 `=== 교수사진 ===`에 붙여넣거나, 이 저장소의 `assets/faculty/교수이름.jpg`로 올립니다.

> 구글 문서는 **공유 → 링크가 있는 모든 사용자 → 뷰어**여야 합니다. 편집 권한은 관리자에게만 주세요.

## 첫 설정

1. **Settings → Pages → Source: GitHub Actions**
2. `site.config.json`의 `googleDoc` 값을 관리 문서 주소로 바꾸고 저장(Commit)

## 도메인 (metaverse.ssu.ac.kr)

1. 학교 DNS 담당(정보전산팀)에 다음 레코드를 요청합니다.
   `metaverse.ssu.ac.kr  CNAME  <GitHub아이디>.github.io.`
2. DNS가 적용되면 **Settings → Pages → Custom domain**에 `metaverse.ssu.ac.kr` 입력 → Save
3. 확인이 끝나면 **Enforce HTTPS** 체크

## 수정하기

- 문구 수정: 해당 `.html` 파일을 GitHub에서 열고 연필(✎) 버튼으로 편집 → Commit. 한국어/영어 문구는 `data-ko` / `data-en` 속성에 함께 들어 있습니다.
- 공통 스타일: `assets/site.css`, 언어 전환·메뉴: `assets/site.js`
