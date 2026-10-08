<!-- 2026-10-08 20:32 KST -->

# 상식 퀴즈 웹 앱 구현 계획서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 서버 없이 `index.html`을 열면 동작하는 4지선다 상식 퀴즈(카테고리 4개, 40문항, 연습, 스피드, 힌트 모드, 순위표)를 3단계로 만든다.

**구조:** 화면 4개를 `index.html`에 `<section>`으로 두고 `script.js`가 보이고 숨기기만 전환한다. `script.js`는 설정, 순수 로직, 저장, 화면 조작, 이벤트 연결로 나누고, 순수 로직은 `script.js` 안의 자체 점검으로 확인한다. 자체 점검은 `node script.js`(터미널)와 `index.html?test`(브라우저 콘솔) 두 곳에서 돈다.

**기술:** HTML, CSS, 바닐라 자바스크립트(일반 `<script>`), localStorage. 외부 라이브러리, 빌드 도구, 테스트 파일 없음. 점검 실행에 Node.js(v24)를 쓴다.

**명세:** [PRD.md](PRD.md). 실행자는 이 계획서와 PRD.md를 함께 읽는다. 화면 문구와 점수 규칙의 원문은 PRD에, 문항 작성 규칙의 정본은 CLAUDE.md에 있고, 이 계획서는 PRD의 절 번호(예: PRD 3.7)로 가리킨다.

## 전체 제약

모든 태스크에 공통으로 적용한다.

- 앱 파일은 `index.html`, `style.css`, `script.js`, `questions.js` 4개뿐이다(PRD 2.1). 점검 코드도 `script.js` 안에 둔다.
- `type="module"`, `fetch`, `import`를 쓰지 않는다. `file://`로 열었을 때 동작해야 한다(PRD 5.1).
- `questions.js`는 `const QUESTIONS = [...]` 다음 줄에 `if (typeof module !== "undefined") module.exports = QUESTIONS;` 한 줄만 더 둔다.
- `script.js`에서 DOM을 쓰는 코드는 `typeof document !== "undefined"`일 때만 실행한다. `node script.js`가 오류 없이 돌아야 한다.
- 화면 문구는 PRD에 적힌 문장을 글자 그대로 쓴다. 한국어 문구는 단순 열거에 가운뎃점(·)을 쓰지 않고, 완결된 문장은 마침표로 끝내며, 보조용언은 띄어 쓴다.
- 새 파일은 첫머리에 생성 일시 주석(`YYYY-MM-DD HH:MM KST`)을 단다. 시각은 `date -u -d "+9 hours" "+%Y-%m-%d %H:%M"`로 확인한다. `index.html`은 `<!doctype html>` 바로 다음 줄에 단다.
- 폭 360px 화면에서 가로 스크롤이 생기지 않아야 한다(PRD 7.2).
- 한 단계를 마치면 멈추고 사람의 확인을 기다린다. 다음 단계는 사람이 시작하라고 할 때 시작한다(PRD 6절).

## 리뷰 초점

어느 태스크의 점검도 직접 다루지 않지만 사용자가 겪기 쉬운 경우다. 각 줄의 대응을 맡은 태스크에 넣어 두었다.

1. **같은 문항을 두 번 채점**: 보기를 빠르게 두 번 누르거나, 스피드 모드에서 답을 누르는 순간 0초가 되면 점수가 두 번 오를 수 있다. 문항마다 한 번만 채점해야 한다. → Task 7의 `state.answered` 가드, Task 10의 확인 항목.
2. **타이머가 남아서 도는 경우**: 결과 화면으로 가거나 새 판을 시작한 뒤에도 이전 타이머가 돌면, 엉뚱한 문항이 시간 초과로 처리된다. → Task 10의 `startTimer`가 항상 이전 타이머를 지우고, `showScreen`으로 화면을 바꿀 때 `stopTimer`를 부른다.
3. **힌트가 정답을 지우는 경우**: 오답 2개를 고르는 무작위 선택이 정답을 고르면 문항을 풀 수 없다. → Task 11의 `pickHintRemovals` 점검(30회 반복).
4. **저장된 순위표 값이 깨진 경우**: localStorage의 값이 JSON이 아니면 순위표 화면이 깨질 수 있다. 빈 순위표로 시작하고 다음 저장 때 덮어쓴다. "기록을 저장할 수 없습니다."는 저장소 자체를 쓸 수 없을 때만 띄운다. → Task 13 점검.
5. **재도전 결과가 첫 점수를 바꾸는 경우**: 재도전에서 맞힌 문항이 첫 시도 점수에 더해지면 PRD 3.6을 어긴다. → Task 12의 확인 항목.

---

## 파일 구조

| 파일 | 책임 | 만드는 태스크 |
|---|---|---|
| `index.html` | 화면 4개(시작, 퀴즈, 결과, 순위표)의 뼈대. `questions.js`, `script.js` 순서로 불러온다. | Task 7 (순위표 화면은 Task 14) |
| `style.css` | 모양. 정답 `.correct`(초록), 오답 `.wrong`(빨강), 힌트로 지운 보기 `.removed`(`visibility: hidden`) | Task 7 |
| `questions.js` | `QUESTIONS` 40문항과 Node용 내보내기 한 줄 | Task 1 (빈 배열), Task 3~6 (문항) |
| `script.js` | 설정, 자체 점검, 순수 로직, 저장, 화면 조작, 이벤트 연결 | Task 1부터 계속 |

`script.js` 안의 순서는 위에서 아래로 다음과 같다(PRD 5.2~5.7).

1. 설정: `MODES`, `CATEGORIES`, `QUESTIONS_PER_ROUND`, `RANKING_SIZE`, `EXPLANATION_MAX`, `STORAGE_KEY`, `MESSAGES`
2. 순수 로직: `validateQuestions`, `shuffle`, `prepareQuestion`, `buildRound`, `scoreFor`, `pickHintRemovals`, `buildRetryRound`, `rankingKey`, `addRecord`, `todayString`
3. 저장: `getStorage`, `loadRankings`, `saveRankings`
4. 게임 상태와 화면 조작: `state`, `showScreen`, `render*`, `showFeedback`, `startTimer`, `stopTimer`
5. 자체 점검: `check`, `runSelfTests`
6. 시작: 브라우저 진입(`DOMContentLoaded`)과 Node 진입

### DOM id

| 화면 | id |
|---|---|
| 시작 | `screen-start`, `mode-buttons`(안에 `button[data-mode]`), `mode-desc`, `category-buttons`(안에 `button[data-category]`), `rankings-btn` |
| 퀴즈 | `screen-quiz`, `quiz-category`, `quiz-mode`, `quiz-progress`, `quiz-score`, `timer`, `question-text`, `choices`(안에 `button.choice` 4개), `hint-btn`, `feedback`, `feedback-result`, `feedback-explanation`, `feedback-source`(`<a target="_blank" rel="noopener">`), `next-btn` |
| 결과 | `screen-result`, `result-category`, `result-mode`, `result-score`, `result-note`, `retry-result`, `retry-btn`, `home-btn` |
| 순위표 | `screen-rankings`, `rankings-body`, `rankings-home-btn` |

화면 전환은 `hidden` 속성으로 한다.

---

## 공통 절차

**점검 명령** (작업 폴더에서 실행)

```bash
node script.js
```

통과 기준: 마지막 줄이 `자체 점검 결과: 통과 N, 실패 0`이고 종료 코드가 0이다.

**화면 확인 (클로드)**

클로드 데스크톱 앱의 내장 브라우저는 `file://`에서 자바스크립트를 실행하지 않는다. 클로드는 `.claude/launch.json`에 `python -m http.server 8000`을 등록해 `http://localhost:8000/`으로 열어 확인한다. `file://`로 여는 확인은 사람에게 요청한다.

**커밋 규칙**

태스크 끝에서 점검 명령이 통과하면 그 태스크의 파일만 `git add`해서 커밋한다. 커밋 메시지는 `feat: …` 형식의 한국어 한 줄이고, 끝에 다음 줄을 붙인다.

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

**단계 마무리**

단계의 마지막 태스크를 마치면 멈추고 다음을 보고한다. ① 점검 명령 결과, ② 클로드가 localhost에서 한 판을 풀어 본 결과, ③ 계획과 달라진 점, ④ 그 단계의 "직접 확인할 항목". 깃허브 Pages 배포는 사람이 확인을 마친 뒤 따로 요청한다(PRD 7.4).

---

## 1단계: 연습 모드와 점수

**만들 것:** 파일 4개의 뼈대, 자체 점검, 문항 40개, 시작 화면(카테고리만), 퀴즈 화면과 피드백, 결과 화면. 모드 선택 화면과 틀린 문제 다시 풀기는 만들지 않는다(PRD 6.1).

**완료 기준 (클로드가 점검):**

- `node script.js`가 실패 0으로 끝난다. 여기에는 `validateQuestions(QUESTIONS)`가 `[]`인 것이 포함된다.
- 40문항의 출처를 모두 열어 대조했고, 문항 검수표(번호, 정답, 출처에서 확인한 내용)를 단계 보고에 붙였다. 대조하지 못한 문항은 목록으로 따로 적었다.
- "가장"이 들어간 문항은 모두 기준과 시점이 문제에 적혀 있다.
- localhost에서 한 카테고리를 끝까지 풀어 결과 화면까지 갔다.

**직접 확인할 항목 (사람이 `index.html`을 더블클릭해서 확인):**

1. 시작 화면에 카테고리 버튼 4개와 "시간 제한과 힌트 없음. 순위표에 기록되지 않음."이 보인다.
2. [한국사]를 누르면 위쪽에 "한국사", "연습", "1 / 10", "점수 0"이 보인다.
3. 정답을 고르면 그 보기가 초록이 되고, "정답입니다.", 해설 한 줄, 출처 링크가 나온다.
4. 오답을 고르면 고른 보기는 빨강, 정답 보기는 초록이 되고 "오답입니다."가 나온다.
5. 답을 고른 뒤에는 다른 보기를 눌러도 아무 변화가 없다.
6. 출처 링크를 누르면 새 탭에서 열리고, 퀴즈 화면은 그대로 남는다.
7. [다음]을 누를 때마다 진행 상황과 점수가 맞게 바뀐다.
8. 10번째 문항에서는 [다음] 대신 [결과 보기]가 나온다.
9. 결과 화면의 "N / 10점"이 맞힌 개수와 같고, "순위표에 기록되지 않음"이 보인다.
10. [처음으로]를 누르면 시작 화면으로 돌아가고, 같은 카테고리를 다시 시작하면 문항 순서와 보기 순서가 앞 판과 다르다.
11. 개발자 도구(F12) 콘솔에 앱의 오류가 없다(`file://`에서 처음 한 번 나는 브라우저 오류는 새로 고침하면 사라지며 무시한다).
12. 기기 툴바로 폭을 360px로 줄여도 가로 스크롤이 생기지 않는다.
13. `index.html?test`로 열면 콘솔에 "자체 점검 결과: 통과 N, 실패 0"이 나온다.
14. 문항 내용은 1단계 확인 뒤 따로 확인한다(PRD 7.3의 사람의 첫 확인).

### Task 1: 설정과 자체 점검 틀, 문항 형식 검사

**Files:**
- Create: `questions.js`, `script.js`

**Interfaces:**
- Produces:
  - 설정 상수 `MODES`, `CATEGORIES`, `QUESTIONS_PER_ROUND`(10), `RANKING_SIZE`(5), `EXPLANATION_MAX`(80), `STORAGE_KEY`(`"quiz-rankings"`), `MESSAGES`
  - `check(name: string, fn: () => any, expected: any): void`: `fn()`의 결과를 `JSON.stringify`로 `expected`와 비교해 결과 목록에 넣는다(그래서 객체는 키 순서까지 같아야 한다). `fn`이 예외를 던지면 실패로 기록한다(아직 없는 함수를 점검해도 멈추지 않게).
  - `runSelfTests(questions: object[]): number`: 모든 점검을 돌려 통과는 `console.log("통과:", name)`, 실패는 `console.error("실패:", name, 실제값, 기대값)`로 찍고, `자체 점검 결과: 통과 N, 실패 M`을 찍은 뒤 실패 수를 돌려준다.
  - `validateQuestions(questions: object[], categories: string[] = CATEGORIES): string[]`

- [ ] **Step 1: `questions.js`를 만든다**

빈 배열 `const QUESTIONS = [];`과 전체 제약의 내보내기 한 줄만 둔다.

- [ ] **Step 2: `script.js`에 설정 상수를 넣는다**

```js
const MODES = {
  practice: { label: "연습",   timeLimit: null, hint: false, ranked: false, desc: "시간 제한과 힌트 없음. 순위표에 기록되지 않음." },
  speed:    { label: "스피드", timeLimit: 15,   hint: false, ranked: true,  desc: "문항마다 15초. 시간이 지나면 오답." },
  hint:     { label: "힌트",   timeLimit: null, hint: true,  ranked: true,  desc: "문항마다 힌트 1번. 힌트를 쓰고 맞히면 0.5점." },
};
const CATEGORIES = ["한국사", "세계지리", "과학", "예술과 문화"];
const QUESTIONS_PER_ROUND = 10;
const RANKING_SIZE = 5;
const EXPLANATION_MAX = 80; // PRD 4.3 규칙 2 "60자 안팎"의 상한
const STORAGE_KEY = "quiz-rankings";
const MESSAGES = {
  correct: "정답입니다.",
  wrong: "오답입니다.",
  timeout: "시간 초과입니다.",
  notRanked: "순위표에 기록되지 않음",
  ranked: (rank) => `순위표 ${rank}위에 기록했습니다.`,
  notInTop: "상위 5위 안에 들지 못해 순위표에 오르지 않았습니다.",
  storageUnavailable: "기록을 저장할 수 없습니다.",
  noRecords: "기록 없음",
};
```

- [ ] **Step 3: 자체 점검 틀과 진입점을 만든다**

`check`, `runSelfTests`를 Interfaces대로 만들고, 파일 맨 끝에 진입점 두 개를 둔다.

```js
if (typeof module !== "undefined" && require.main === module) {
  process.exitCode = runSelfTests(require("./questions.js")) ? 1 : 0;
}
```

브라우저 진입점은 `typeof document !== "undefined"`일 때 `DOMContentLoaded`에서 `new URLSearchParams(location.search).has("test")`이면 `runSelfTests(QUESTIONS)`를 부른다(게임 초기화는 Task 7에서 같은 자리에 더한다). 브라우저에서는 시작할 때 `validateQuestions(QUESTIONS)`의 오류를 `console.error`로 하나씩 찍는다(PRD 5.7). 화면은 막지 않는다.

- [ ] **Step 4: 문항 형식 점검을 쓴다 (실패 확인용)**

`runSelfTests` 안에 다음 도우미와 점검을 넣는다.

```js
const sample = (over = {}) => ({ category: "한국사", question: "샘플 문제", choices: ["가", "나", "다", "라"], answer: 0,
  explanation: "샘플 해설", source: { title: "샘플 출처", url: "https://example.com" }, ...over });
const tenOf = (category) => Array.from({ length: 10 }, (_, i) => sample({ category, question: `${category} 문제 ${i + 1}` }));

check("형식: 올바른 문항은 오류 없음", () => validateQuestions([sample()], []), []);
check("형식: 보기 3개", () => validateQuestions([sample({ choices: ["가", "나", "다"] })], []).length, 1);
check("형식: 보기 중복", () => validateQuestions([sample({ choices: ["가", "가", "다", "라"] })], []).length, 1);
check("형식: answer 범위 밖", () => validateQuestions([sample({ answer: 4 })], []).length, 1);
check("형식: 출처 주소 없음", () => validateQuestions([sample({ source: { title: "t", url: "" } })], []).length, 1);
check("형식: 해설 81자", () => validateQuestions([sample({ explanation: "가".repeat(81) })], []).length, 1);
check("형식: 없는 카테고리", () => validateQuestions([sample({ category: "음악" })], []).length, 1);
check("형식: 카테고리 10문항이면 통과", () => validateQuestions(tenOf("과학"), ["과학"]), []);
check("형식: 카테고리 문항 수 부족", () => validateQuestions([sample()], ["한국사"]).length, 1);
```

- [ ] **Step 5: 실패를 확인한다**

Run: `node script.js`
Expected: `validateQuestions` 점검이 모두 "실패:"로 찍히고(함수가 없으므로), 종료 코드 1.

- [ ] **Step 6: `validateQuestions(questions, categories = CATEGORIES)`를 만든다**

문항마다 다음을 검사하고, 어긋날 때마다 `"N번 문항: …"` 형식의 문구 하나를 배열에 넣는다. 문항 하나에서 한 항목은 문구 하나만 낸다.
- `category`가 `CATEGORIES` 안에 있음
- `question`이 빈 문자열이 아님
- `choices`가 서로 다른 빈 문자열 아닌 문자열 4개
- `answer`가 0~3의 정수
- `explanation`이 비어 있지 않고 `EXPLANATION_MAX`자 이하
- `source.title`이 비어 있지 않고 `source.url`이 `https://` 또는 `http://`로 시작

그다음 `categories`의 카테고리마다 문항 수가 `QUESTIONS_PER_ROUND`가 아니면 `"<카테고리>: 문항 N개(10개 필요)"`를 넣는다.

- [ ] **Step 7: 통과를 확인한다**

Run: `node script.js`
Expected: `자체 점검 결과: 통과 9, 실패 0`, 종료 코드 0.

- [ ] **Step 8: 커밋한다**

`git add questions.js script.js` 후 `feat: 설정, 자체 점검, 문항 형식 검사 추가`.

### Task 2: 판 만들기와 점수 계산

**Files:**
- Modify: `script.js` (순수 로직 구역, 자체 점검)

**Interfaces:**
- Consumes: `check`, `CATEGORIES`, `QUESTIONS_PER_ROUND`, Task 1의 `sample`, `tenOf`
- Produces:
  - `shuffle(array: any[]): any[]`: 섞은 새 배열. 원본은 그대로 둔다(Fisher-Yates).
  - `prepareQuestion(q: object): object`: 보기를 섞은 새 문항. `answer`는 섞은 뒤 정답의 위치다. 나머지 필드는 그대로.
  - `buildRound(questions: object[], category: string): object[]`: 해당 카테고리 문항을 섞어 앞에서 `QUESTIONS_PER_ROUND`개를 고르고 `prepareQuestion`을 적용한다.
  - `scoreFor(mode: "practice"|"speed"|"hint", isCorrect: boolean, hintUsed: boolean): number`: PRD 3.9 표대로 1, 0.5, 0.

- [ ] **Step 1: 점검을 쓴다**

```js
check("섞기: 같은 원소", () => shuffle([1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
check("섞기: 원본 유지", () => { const a = [1, 2, 3]; shuffle(a); return a; }, [1, 2, 3]);
check("보기 섞기: 정답 유지(20회)", () => Array.from({ length: 20 }, () => {
  const q = prepareQuestion(sample({ answer: 2 })); return q.choices[q.answer]; }).every((c) => c === "다"), true);
check("판 만들기: 10문항, 같은 카테고리", () => {
  const r = buildRound([...tenOf("과학"), ...tenOf("한국사")], "과학");
  return [r.length, r.every((q) => q.category === "과학")]; }, [10, true]);
check("점수: 연습 정답", () => scoreFor("practice", true, false), 1);
check("점수: 연습 오답", () => scoreFor("practice", false, false), 0);
check("점수: 스피드 정답", () => scoreFor("speed", true, false), 1);
check("점수: 스피드 오답", () => scoreFor("speed", false, false), 0);
check("점수: 힌트 없이 정답", () => scoreFor("hint", true, false), 1);
check("점수: 힌트 쓰고 정답", () => scoreFor("hint", true, true), 0.5);
check("점수: 힌트 쓰고 오답", () => scoreFor("hint", false, true), 0);
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node script.js` → Expected: 새 점검 11개가 실패, 종료 코드 1.

- [ ] **Step 3: `shuffle`, `prepareQuestion`, `buildRound`, `scoreFor`를 Interfaces대로 만든다**

- [ ] **Step 4: 통과를 확인한다**

Run: `node script.js` → Expected: 실패 0.

- [ ] **Step 5: 커밋한다**

`git add script.js` 후 `feat: 판 만들기와 점수 계산 추가`.

### Task 3~6: 문항 작성 (카테고리마다 10문항)

태스크 하나가 카테고리 하나를 맡는다. 네 태스크의 절차는 같고, 카테고리와 점검 줄만 다르다.

| Task | 카테고리 | Step 1에서 둘 점검 |
|---|---|---|
| 3 | 한국사 | `check("문항: 작성분 형식", () => validateQuestions(questions, ["한국사"]), [])` |
| 4 | 세계지리 | 위 줄의 배열을 `["한국사", "세계지리"]`로 바꾼다 |
| 5 | 과학 | `["한국사", "세계지리", "과학"]`으로 바꾼다 |
| 6 | 예술과 문화 | 줄을 `check("문항: 40문항 형식", () => validateQuestions(questions), [])`로 바꾼다 |

**Files:**
- Modify: `questions.js`, `script.js` (자체 점검 한 줄)

**Interfaces:**
- Consumes: `validateQuestions`(Task 1), `runSelfTests`가 받는 `questions` 인자
- Produces: `QUESTIONS`에 그 카테고리의 문항 10개(PRD 4.2 형식)

**문항 작성 기준** (PRD 4.3과 CLAUDE.md의 문항 작성 규칙에 더해 이 계획에서 정함)

- 대학 1학년이 교양으로 알 만한 수준이다. 한 카테고리 안에서 시대, 지역, 분야가 고르게 섞이게 한다.
- 학계에 이견이 있거나 출처마다 답이 다른 주제는 피한다. 피할 수 없으면 다른 것을 묻는 문항으로 바꾼다.
- 부정형 문제("~이 아닌 것은?")는 쓰지 않는다. 4지선다에서 정답이 여러 개로 읽히기 쉽다.
- **출처로 쓰는 곳:** 정부와 공공기관(`go.kr` 등), 박물관과 학술기관, 한국민족문화대백과사전, 우리역사넷, 브리태니커, 두산백과, NASA 같은 공식 기관 사이트.
- **출처로 쓰지 않는 곳:** 위키백과, 나무위키처럼 누구나 고치는 위키, 블로그, 카페, 개인 사이트, AI가 만든 요약.
- 출처는 실제로 열어서 정답과 해설 내용이 그 문서에 있는지 대조한다. 열 수 없는 출처만 있는 주제는 열 수 있는 주제로 바꾼다.

- [ ] **Step 1: 점검 줄을 표대로 넣는다**

- [ ] **Step 2: 실패를 확인한다**

Run: `node script.js` → Expected: 그 카테고리의 "문항 0개(10개 필요)" 때문에 실패 1, 종료 코드 1.

- [ ] **Step 3: 문항 10개를 쓴다**

문항마다 출처 페이지를 열어 대조하고, 대조 결과를 검수표 한 줄(번호, 문제 요약, 정답, 출처에서 확인한 내용, 대조 여부)로 남긴다. 검수표는 1단계 보고에 붙인다(파일로 만들지 않는다).

- [ ] **Step 4: 통과를 확인한다**

Run: `node script.js` → Expected: 실패 0.

- [ ] **Step 5: 최상급 표현을 점검한다**

Run: `grep -n "가장\|최대\|최초\|최고" questions.js`
Expected: 찾은 문항마다 문제에 기준과 시점이 적혀 있다(CLAUDE.md 문항 작성 규칙 2). 빠진 문항은 고치고 Step 4를 다시 한다.

- [ ] **Step 6: 커밋한다**

`git add questions.js script.js` 후 `feat: <카테고리> 문항 10개 추가`.

### Task 7: 시작 화면, 퀴즈 화면, 피드백

**Files:**
- Create: `index.html`, `style.css`
- Modify: `script.js` (게임 상태, 화면 조작, 브라우저 진입점)

**Interfaces:**
- Consumes: `buildRound`, `scoreFor`, `MODES`, `CATEGORIES`, `MESSAGES`, 파일 구조의 DOM id
- Produces:
  - `state`: PRD 5.3의 필드에 `answered: boolean`(지금 문항을 채점했는지)을 더한 객체. Task 9~14가 이 이름을 그대로 쓴다.
  - `showScreen(id: string): void`: 화면 4개 중 `id`만 보이게 한다. 부를 때마다 `stopTimer()`를 부른다(Task 10 전까지는 빈 함수로 둔다).
  - `renderStart(): void`, `startRound(category: string): void`, `renderQuestion(): void`, `choose(index: number): void`, `showFeedback(choiceIndex: number|null): void`, `nextQuestion(): void`
  - `finishPass(): void`: 마지막 문항 뒤 결과 화면으로 간다(Task 8에서 채운다).

- [ ] **Step 1: `index.html`, `style.css`를 만든다**

화면 4개 중 시작, 퀴즈, 결과 `<section>`과 DOM id를 둔다(순위표 화면은 Task 14). 1단계에서는 `mode-buttons`와 `rankings-btn`을 두지 않고, `timer`와 `hint-btn`은 `hidden`으로 둔다. `mode-desc`에는 `MODES.practice.desc`가 나오게 한다. `<meta name="viewport" content="width=device-width, initial-scale=1">`를 넣고, 보기 버튼은 폭 100% 세로 배치로 해서 360px에서 넘치지 않게 한다.

- [ ] **Step 2: 화면 조작을 만든다**

- `startRound(category)`: `state`를 새 판으로 초기화하고(`mode`는 1단계에서 늘 `"practice"`) `buildRound(QUESTIONS, category)`로 문항을 채운 뒤 `renderQuestion()`.
- `renderQuestion()`: `quiz-category`, `quiz-mode`(`MODES[state.mode].label`), `quiz-progress`(`"3 / 10"`), `quiz-score`(`"점수 2.5"`), 문제, 보기 4개를 그린다. `state.answered = false`, `state.hintUsed = false`로 두고 피드백 영역은 숨긴다.
- `choose(index)`: `state.answered`가 참이면 아무것도 하지 않는다(리뷰 초점 1). 아니면 `showFeedback(index)`.
- `showFeedback(choiceIndex)`: `state.answered`가 참이면 바로 끝낸다. 아니면 `answered = true`, `stopTimer()`, 채점(`scoreFor`), 정답 보기에 `.correct`, 고른 오답에 `.wrong`, 모든 보기와 `hint-btn`을 `disabled`로 한다. 결과 문구는 `choiceIndex === null`이면 `MESSAGES.timeout`, 맞으면 `MESSAGES.correct`, 틀리면 `MESSAGES.wrong`. 틀리면 그 문항을 `state.wrong`에 넣는다. 해설과 출처 링크(`source.title`, `source.url`)를 보여 주고, `next-btn` 글자는 마지막 문항이면 "결과 보기", 아니면 "다음".
- `nextQuestion()`: 마지막 문항이면 `finishPass()`, 아니면 `index`를 올리고 `renderQuestion()`.

- [ ] **Step 3: 브라우저 진입점에 초기화를 더한다**

`DOMContentLoaded`에서 이벤트를 연결하고 `renderStart()`, `showScreen("screen-start")`.

- [ ] **Step 4: 점검과 화면을 확인한다**

Run: `node script.js` → Expected: 실패 0(Node에서 DOM 코드가 돌지 않음).
localhost에서 [한국사]를 눌러 1단계 직접 확인 항목 2~7이 되는지 본다.

- [ ] **Step 5: 커밋한다**

`git add index.html style.css script.js` 후 `feat: 시작 화면과 퀴즈 화면 추가`.

### Task 8: 결과 화면과 처음으로

**Files:**
- Modify: `index.html`, `script.js`

**Interfaces:**
- Consumes: `state`, `showScreen`, `MESSAGES`
- Produces: `renderResult(): void`, `finishPass()`(결과 화면으로 가는 본체), `goHome(): void`(`renderStart()` 후 시작 화면)

- [ ] **Step 1: `renderResult()`를 만든다**

`result-category`, `result-mode`, `result-score`(`"7.5 / 10점"`, 숫자는 `String(state.score)` 그대로)를 채운다. 모드가 `ranked`가 아니면 `result-note`에 `MESSAGES.notRanked`. `retry-result`, `retry-btn`은 숨긴다(Task 12에서 쓴다).

- [ ] **Step 2: `finishPass()`와 `goHome()`을 연결한다**

`finishPass()`는 `renderResult()` 후 `showScreen("screen-result")`. `home-btn`은 `goHome()`.

- [ ] **Step 3: 점검과 화면을 확인한다**

Run: `node script.js` → Expected: 실패 0.
localhost에서 한 판을 끝까지 풀어 1단계 직접 확인 항목 8~10을 본다.

- [ ] **Step 4: 커밋하고 1단계 마무리 보고를 한 뒤 멈춘다**

`git add index.html script.js` 후 `feat: 결과 화면 추가`. 공통 절차의 "단계 마무리"대로 보고하고 **멈춘다**.

---

## 2단계: 스피드 모드, 힌트 모드, 틀린 문제 다시 풀기

**만들 것:** 시작 화면의 모드 선택, 스피드 모드 타이머, 힌트 모드, 연습 모드의 틀린 문제 다시 풀기(PRD 6.2).

**완료 기준 (클로드가 점검):**

- `node script.js`가 실패 0이다(`pickHintRemovals`, `buildRetryRound` 점검 포함).
- localhost에서 세 모드로 한 판씩 끝까지 풀어 보았다.

**직접 확인할 항목:**

1. 시작 화면에서 모드 3개 중 하나를 고르면 그 모드의 규칙 한 줄이 바뀌어 보이고, 연습 모드에서는 "순위표에 기록되지 않음"이 들어 있다.
2. 모드를 고른 뒤 카테고리를 누르면 그 모드로 시작하고, 위쪽에 모드 이름이 보인다.
3. 스피드: 문항이 나오면 15부터 1초씩 줄어든다.
4. 스피드: 답을 고르면 타이머가 그 자리에서 멈춘다.
5. 스피드: 아무것도 고르지 않고 0초가 되면 "시간 초과입니다.", 정답, 해설이 나오고 점수가 오르지 않는다.
6. 스피드: 해설을 띄워 둔 채 20초 넘게 기다려도 타이머가 줄지 않는다.
7. 스피드: [다음]을 누르면 다음 문항이 15초부터 시작한다.
8. 스피드: 14초 근처에서 보기를 빠르게 두 번 눌러도 점수는 한 번만 오른다.
9. 힌트: [힌트]를 누르면 오답 보기 2개가 사라지고, 정답 보기는 남으며, 남은 보기의 위치는 그대로다.
10. 힌트: 한 문항에서 [힌트]는 한 번만 누를 수 있고, 답을 고른 뒤에도 누를 수 없다. 다음 문항에서는 다시 쓸 수 있다.
11. 힌트: 힌트 없이 맞히면 1점, 힌트를 쓰고 맞히면 0.5점이 오르고, 결과 화면에 "7.5 / 10점"처럼 소수점이 보인다.
12. 연습, 힌트 모드에는 타이머가 없고, 연습, 스피드 모드에는 [힌트]가 없다.
13. 연습: 틀린 문제가 있으면 결과 화면에 [틀린 문제 다시 풀기]가 보이고, 모두 맞혔으면 보이지 않는다.
14. 연습: [틀린 문제 다시 풀기]를 누르면 그 판에서 틀린 문항만 나온다.
15. 연습: 재도전이 끝나면 첫 시도 점수는 그대로이고 "재도전 N/M"이 따로 보인다. 또 틀렸으면 버튼이 다시 보이고 그 문항만 나온다.
16. 스피드, 힌트 모드의 결과 화면에는 [틀린 문제 다시 풀기]가 없다.
17. 1단계 직접 확인 항목 1~13을 연습 모드로 다시 통과한다(1번은 이 단계의 1번으로 대신한다).

### Task 9: 모드 선택

**Files:**
- Modify: `index.html`, `style.css`, `script.js`

**Interfaces:**
- Consumes: `MODES`, `state`, `renderStart`, `startRound`
- Produces: `selectMode(mode: "practice"|"speed"|"hint"): void`: `state.mode`를 바꾸고 선택된 버튼에 `.selected`를 달고 `mode-desc`에 `MODES[mode].desc`를 쓴다.

- [ ] **Step 1: 시작 화면에 `mode-buttons`(연습, 스피드, 힌트)를 더한다.** 처음 선택값은 `"practice"`이고, [처음으로]로 돌아와도 마지막에 고른 모드를 유지한다.
- [ ] **Step 2: `startRound`가 `state.mode`를 초기화하지 않고 그대로 쓰게 고친다.**
- [ ] **Step 3: 확인한다.** `node script.js` 실패 0. localhost에서 2단계 직접 확인 항목 1~2.
- [ ] **Step 4: 커밋한다.** `feat: 모드 선택 추가`.

### Task 10: 스피드 모드 타이머

**Files:**
- Modify: `index.html`, `script.js`

**Interfaces:**
- Consumes: `state.timeLeft`, `state.timerId`, `showFeedback(null)`, `MODES[mode].timeLimit`
- Produces: `startTimer(): void`, `stopTimer(): void`(Task 7의 빈 함수를 채운다)

- [ ] **Step 1: `startTimer()`를 만든다.** 먼저 `stopTimer()`로 이전 타이머를 지운다(리뷰 초점 2). `state.timeLeft = MODES[state.mode].timeLimit`, `timer`에 남은 초를 쓰고, 1초마다 1씩 줄인다. 0이 되면 `stopTimer()` 후 `showFeedback(null)`.
- [ ] **Step 2: `stopTimer()`를 만든다.** `clearInterval(state.timerId)`, `state.timerId = null`.
- [ ] **Step 3: 연결한다.** `renderQuestion()` 끝에서 `timeLimit`이 있으면 `startTimer()`, 없으면 `timer`를 숨긴다. `showFeedback`과 `showScreen`은 이미 `stopTimer()`를 부른다.
- [ ] **Step 4: 확인한다.** `node script.js` 실패 0. localhost에서 2단계 직접 확인 항목 3~8.
- [ ] **Step 5: 커밋한다.** `feat: 스피드 모드 타이머 추가`.

### Task 11: 힌트 모드

**Files:**
- Modify: `index.html`, `style.css`, `script.js`

**Interfaces:**
- Consumes: `state.hintUsed`, `state.answered`, `scoreFor`, `shuffle`
- Produces: `pickHintRemovals(q: object): number[]`: 정답이 아닌 보기 위치 3개 중 2개를 무작위로 골라 돌려준다. `useHint(): void`

- [ ] **Step 1: 점검을 쓴다**

```js
check("힌트: 2개, 서로 다름, 정답 아님(30회)", () => Array.from({ length: 30 }, () => {
  const r = pickHintRemovals(sample({ answer: 1 }));
  return r.length === 2 && r[0] !== r[1] && !r.includes(1) && r.every((i) => i >= 0 && i <= 3); }).every(Boolean), true);
```

- [ ] **Step 2: 실패를 확인한다.** `node script.js` → 위 점검 실패, 종료 코드 1.
- [ ] **Step 3: `pickHintRemovals`를 만든다.**
- [ ] **Step 4: 통과를 확인한다.** `node script.js` → 실패 0.
- [ ] **Step 5: 화면에 연결한다.** `hint-btn`은 힌트 모드에서만 보인다. `useHint()`는 `state.answered`나 `state.hintUsed`가 참이면 아무것도 하지 않고, 아니면 `hintUsed = true`, 고른 두 보기에 `.removed`를 달고 `disabled`, `hint-btn`을 `disabled`로 한다. `showFeedback`의 채점은 `scoreFor(state.mode, 맞음, state.hintUsed)`를 쓴다.
- [ ] **Step 6: 확인한다.** localhost에서 2단계 직접 확인 항목 9~12.
- [ ] **Step 7: 커밋한다.** `feat: 힌트 모드 추가`.

### Task 12: 틀린 문제 다시 풀기

**Files:**
- Modify: `index.html`, `script.js`

**Interfaces:**
- Consumes: `state.wrong`, `state.isRetry`, `state.retryCorrect`, `prepareQuestion`, `shuffle`, `renderResult`
- Produces: `buildRetryRound(wrongQuestions: object[]): object[]`: 틀린 문항을 섞고 각각 `prepareQuestion`을 다시 적용한다. `startRetry(): void`

- [ ] **Step 1: 점검을 쓴다**

```js
check("재도전: 틀린 문항만, 정답 유지", () => {
  const wrong = [1, 2, 3].map((n) => sample({ question: `틀린 ${n}`, answer: 3 }));
  const r = buildRetryRound(wrong);
  return [r.length, r.map((q) => q.question).sort(), r.every((q) => q.choices[q.answer] === "라")]; },
  [3, ["틀린 1", "틀린 2", "틀린 3"], true]);
```

- [ ] **Step 2: 실패를 확인한다.** `node script.js` → 위 점검 실패.
- [ ] **Step 3: `buildRetryRound`를 만든다.**
- [ ] **Step 4: 통과를 확인한다.** `node script.js` → 실패 0.
- [ ] **Step 5: 흐름을 연결한다.**
  - `startRetry()`: `state.questions = buildRetryRound(state.wrong)`, `state.wrong = []`, `index = 0`, `isRetry = true`, `retryCorrect = 0` 후 `renderQuestion()`.
  - 재도전 중에는 `showFeedback`이 `state.score`를 바꾸지 않고, 맞히면 `retryCorrect`만 올린다(리뷰 초점 5). 퀴즈 화면 위쪽의 점수 칸에는 첫 시도 점수를 그대로 보여 준다.
  - `renderResult()`: 재도전 뒤면 `retry-result`에 `재도전 ${retryCorrect}/${questions.length}`를 보인다. `retry-btn`은 모드가 `practice`이고 `state.wrong.length > 0`일 때만 보인다.
  - `startRound`는 `isRetry = false`로 초기화한다.
- [ ] **Step 6: 확인한다.** localhost에서 2단계 직접 확인 항목 13~16.
- [ ] **Step 7: 커밋하고 2단계 마무리 보고를 한 뒤 멈춘다.** `feat: 틀린 문제 다시 풀기 추가`. 공통 절차의 "단계 마무리"대로 보고하고 **멈춘다**.

---

## 3단계: 점수 저장과 순위표

**만들 것:** 스피드, 힌트 모드 기록의 localStorage 저장, 결과 화면의 순위 안내, 순위표 화면(PRD 6.3).

**완료 기준 (클로드가 점검):**

- `node script.js`가 실패 0이다(`addRecord`, `loadRankings`, `saveRankings` 점검 포함).
- localhost에서 스피드, 힌트 모드로 판을 끝내 순위표에 기록이 쌓이는 것을 보았다.

**직접 확인할 항목:**

1. 스피드나 힌트 모드로 한 판을 끝내면 결과 화면에 "순위표 N위에 기록했습니다." 또는 "상위 5위 안에 들지 못해 순위표에 오르지 않았습니다."가 나온다.
2. 연습 모드로 한 판을 끝내면 결과 화면에 "순위표에 기록되지 않음"이 나오고 순위표는 그대로다.
3. 시작 화면의 [순위표]를 누르면 스피드, 힌트 모드와 카테고리 4개, 8개 표가 보인다. 기록이 없는 표는 "기록 없음"이다.
4. 기록은 점수와 날짜(YYYY-MM-DD)로 보이고, 점수가 높은 순이다.
5. 같은 점수의 기록은 먼저 세운 기록이 위에 있다.
6. 같은 모드와 카테고리로 6판 넘게 하면 표에는 상위 5개만 남는다.
7. 브라우저를 닫았다가 다시 열어도 기록이 남아 있다.
8. 순위표 화면의 [처음으로]를 누르면 시작 화면으로 돌아간다.
9. 콘솔에서 `Storage.prototype.setItem = () => { throw new Error("test"); }`를 실행한 뒤 스피드 모드로 한 판을 끝내면, 게임은 끝까지 진행되고 결과 화면에 "기록을 저장할 수 없습니다."가 나온다(새로 고침하면 원래대로 돌아온다).
10. 배포 주소에서도 7번을 확인한다. `file://`와 배포 주소는 기록을 따로 저장한다.
11. 1단계, 2단계 직접 확인 항목을 다시 통과한다.

### Task 13: 순위 계산과 저장

**Files:**
- Modify: `script.js`

**Interfaces:**
- Consumes: `RANKING_SIZE`, `STORAGE_KEY`
- Produces:
  - `rankingKey(mode: string, category: string): string`: `"speed:한국사"` 형식
  - `addRecord(list: {score:number, date:string}[], record: {score, date}): { list: {score, date}[], rank: number|null }`: 원본을 바꾸지 않는다. 점수 내림차순, 동점이면 기존 기록이 위. 상위 `RANKING_SIZE`개만 남기고, 새 기록이 남았으면 1부터 센 순위, 아니면 `null`.
  - `todayString(date: Date = new Date()): string`: 로컬 날짜 `"YYYY-MM-DD"`
  - `getStorage(): Storage|null`: `window.localStorage`를 `try … catch`로 돌려준다. 접근이 막히면 `null`.
  - `loadRankings(storage: Storage|null): object|null`: 저장소가 없거나 `getItem`이 예외를 던지면 `null`. 값이 없거나 JSON이 깨졌으면 `{}`(리뷰 초점 4).
  - `saveRankings(rankings: object, storage: Storage|null): boolean`: 성공하면 `true`, 저장소가 없거나 예외면 `false`.

- [ ] **Step 1: 점검을 쓴다**

```js
const rec = (score, date) => ({ score, date });
const fakeStorage = (value, { failGet = false, failSet = false } = {}) => ({
  data: value, getItem() { if (failGet) throw new Error("x"); return this.data; },
  setItem(k, v) { if (failSet) throw new Error("x"); this.data = v; } });

check("순위: 키 형식", () => rankingKey("speed", "한국사"), "speed:한국사");
check("순위: 동점이면 먼저 세운 기록이 위", () => addRecord([rec(8, "a")], rec(8, "b")), { list: [rec(8, "a"), rec(8, "b")], rank: 2 });
check("순위: 높은 점수가 위", () => addRecord([rec(7, "a")], rec(9.5, "b")).rank, 1);
check("순위: 5개만 남고 못 들면 null", () => {
  const five = [10, 9, 8, 7, 6].map((s) => rec(s, "a")); const r = addRecord(five, rec(5, "b"));
  return [r.list.length, r.rank]; }, [5, null]);
check("순위: 원본 유지", () => { const l = [rec(8, "a")]; addRecord(l, rec(9, "b")); return l.length; }, 1);
check("날짜: YYYY-MM-DD", () => todayString(new Date(2026, 9, 8)), "2026-10-08");
check("불러오기: 값 없음", () => loadRankings(fakeStorage(null)), {});
check("불러오기: 깨진 값", () => loadRankings(fakeStorage("{깨짐")), {});
check("불러오기: 저장소 예외", () => loadRankings(fakeStorage(null, { failGet: true })), null);
check("불러오기: 저장소 없음", () => loadRankings(null), null);
check("저장: 성공 후 다시 읽기", () => { const s = fakeStorage(null);
  return [saveRankings({ "speed:과학": [rec(9, "a")] }, s), loadRankings(s)]; }, [true, { "speed:과학": [rec(9, "a")] }]);
check("저장: 예외면 false", () => saveRankings({}, fakeStorage(null, { failSet: true })), false);
```

- [ ] **Step 2: 실패를 확인한다.** `node script.js` → 위 점검 실패, 종료 코드 1.
- [ ] **Step 3: Interfaces의 함수 여섯 개를 만든다.** 저장소에 접근하는 코드는 모두 `try … catch`로 감싼다.
- [ ] **Step 4: 통과를 확인한다.** `node script.js` → 실패 0.
- [ ] **Step 5: 커밋한다.** `feat: 순위 계산과 저장 추가`.

### Task 14: 결과 화면 기록과 순위표 화면

**Files:**
- Modify: `index.html`, `style.css`, `script.js`

**Interfaces:**
- Consumes: Task 13의 함수 전부, `renderResult`, `showScreen`, `MESSAGES`
- Produces: `recordResult(): string`(결과 화면에 쓸 안내 문구), `renderRankings(): void`

- [ ] **Step 1: `recordResult()`를 만든다.** 첫 시도의 결과 화면에서만 한 번 부른다(재도전 결과 화면에서는 부르지 않는다). `loadRankings(getStorage())`가 `null`이면 `MESSAGES.storageUnavailable`. 아니면 `addRecord`로 넣고 `saveRankings`가 `false`면 `MESSAGES.storageUnavailable`, 아니면 `rank`에 따라 `MESSAGES.ranked(rank)` 또는 `MESSAGES.notInTop`. `renderResult()`는 `ranked` 모드에서 이 문구를 `result-note`에 쓴다.
- [ ] **Step 2: 순위표 화면을 만든다.** `screen-rankings`, `rankings-body`, `rankings-home-btn`과 시작 화면의 `rankings-btn`을 더한다. `renderRankings()`는 스피드, 힌트 순으로 모드 제목 아래 카테고리 4개의 표(순위, 점수, 날짜)를 그린다. 기록이 없으면 `MESSAGES.noRecords`, `loadRankings`가 `null`이면 표 대신 `MESSAGES.storageUnavailable`.
- [ ] **Step 3: 확인한다.** `node script.js` 실패 0. localhost에서 3단계 직접 확인 항목 1~6, 8, 9.
- [ ] **Step 4: 커밋하고 3단계 마무리 보고를 한 뒤 멈춘다.** `feat: 순위표 추가`. 공통 절차의 "단계 마무리"대로 보고하고 **멈춘다**.

---

## PRD 대응표

| PRD | 태스크 |
|---|---|
| 2.1 파일 4개, 서버 없음 | 전체 제약, Task 1, 7 |
| 2.1 깃허브 Pages 배포 | 공통 절차 "단계 마무리"(사람이 확인 뒤 따로 요청) |
| 3.1~3.2 화면 목록과 흐름 | Task 7, 8, 14 |
| 3.3 시작 화면, 모드 규칙 한 줄 | Task 7(1단계), Task 9 |
| 3.4 퀴즈 화면, 피드백 | Task 7 |
| 3.5 결과 화면 | Task 8, 12, 14 |
| 3.6 연습 모드, 틀린 문제 다시 풀기 | Task 7, 8, 12 |
| 3.7 스피드 모드 | Task 10 |
| 3.8 힌트 모드 | Task 11 |
| 3.9 점수 규칙 | Task 2, 11 |
| 3.10 순위표 | Task 13, 14 |
| 4.1~4.2 카테고리, 40문항, 데이터 형식 | Task 1, 3~6 |
| 4.3 문항 규칙 1~2(출처, 해설 길이), CLAUDE.md 문항 작성 규칙 | Task 1(형식), Task 3~6(내용, 출처, 최상급) |
| 5.1 파일 구성, Node 내보내기 | 전체 제약, Task 1 |
| 5.2~5.6 `script.js` 구조 | 파일 구조, Task 1, 2, 7, 10, 11, 13 |
| 5.7 오류 처리, 자체 점검 | Task 1 |
| 6.1 1단계 완료 기준 | 1단계 완료 기준, 직접 확인할 항목 |
| 6.2 2단계 완료 기준 | 2단계 완료 기준, 직접 확인할 항목 |
| 6.3 3단계 완료 기준 | 3단계 완료 기준, 직접 확인할 항목 |
| 7.1~7.5 검증 방법 | 공통 절차, 각 단계의 직접 확인할 항목 |
| 8 범위 밖 | 해당 태스크 없음(난이도 칸, 이름 입력을 만들지 않음) |

### PRD와 다르게, 또는 PRD에 더해 정한 것

| 항목 | 이 계획의 결정 | 이유 |
|---|---|---|
| 해설 길이 | "60자 안팎"을 `EXPLANATION_MAX = 80`으로 검사 | 기계로 검사할 수 있는 상한이 필요함 |
| 저장된 값이 깨진 경우 | 안내 없이 빈 순위표로 시작하고 다음 저장 때 덮어씀 | 저장이 실제로 되는데 "기록을 저장할 수 없습니다."를 띄우면 맞지 않음. 저장소 자체를 못 쓸 때는 PRD대로 그 문구를 띄움 |
| `loadRankings`, `saveRankings` 인자 | 저장소를 인자로 받음 | Node 점검에서 가짜 저장소로 확인하려고 |
| 상태 필드 | `state.answered`를 더함 | 같은 문항 두 번 채점 방지(리뷰 초점 1) |
| 출처 범위 | 위키, 블로그, 개인 사이트를 출처로 쓰지 않음 | PRD 4.3 규칙 1의 "확인한 출처"를 믿을 만한 곳으로 한정 |
| 부정형 문제 | 쓰지 않음 | 정답이 여러 개로 읽히기 쉬움(CLAUDE.md 문항 작성 규칙 1, 9) |
| 문항 검수표 | 1단계 보고에 붙임(파일로 만들지 않음) | 사람의 첫 확인(PRD 7.3)에 쓰려고 |
