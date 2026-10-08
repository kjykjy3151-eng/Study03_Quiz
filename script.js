// 2026-10-08 20:46 KST

// ===== 1. 설정 =====

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

// ===== 2. 순수 로직 (DOM과 localStorage를 쓰지 않음) =====

const isFilledString = (value) => typeof value === "string" && value.trim() !== "";

// PRD 4.2의 형식을 검사해 오류 문구 배열을 돌려준다. categories의 카테고리마다 문항 수도 센다.
function validateQuestions(questions, categories = CATEGORIES) {
  const errors = [];
  questions.forEach((q, i) => {
    const at = `${i + 1}번 문항: `;
    if (!CATEGORIES.includes(q.category)) errors.push(`${at}카테고리 "${q.category}"는 없는 카테고리입니다.`);
    if (!isFilledString(q.question)) errors.push(`${at}문제가 비어 있습니다.`);
    const choices = q.choices;
    if (!Array.isArray(choices) || choices.length !== 4 || !choices.every(isFilledString) || new Set(choices).size !== 4) {
      errors.push(`${at}보기는 서로 다른 4개여야 합니다.`);
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push(`${at}answer는 0~3이어야 합니다.`);
    if (!isFilledString(q.explanation) || q.explanation.length > EXPLANATION_MAX) {
      errors.push(`${at}해설은 비어 있지 않고 ${EXPLANATION_MAX}자 이하여야 합니다.`);
    }
    if (!q.source || !isFilledString(q.source.title) || !/^https?:\/\//.test(q.source.url || "")) {
      errors.push(`${at}출처에는 제목과 http(s) 주소가 있어야 합니다.`);
    }
  });
  for (const category of categories) {
    const count = questions.filter((q) => q.category === category).length;
    if (count !== QUESTIONS_PER_ROUND) errors.push(`${category}: 문항 ${count}개(${QUESTIONS_PER_ROUND}개 필요)`);
  }
  return errors;
}

// Fisher-Yates로 섞은 새 배열을 돌려준다. 원본은 그대로 둔다.
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 보기를 섞고, 섞은 뒤의 정답 위치를 answer에 담은 새 문항을 돌려준다.
function prepareQuestion(q) {
  const order = shuffle(q.choices.map((_, i) => i));
  return { ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer) };
}

function buildRound(questions, category) {
  return shuffle(questions.filter((q) => q.category === category))
    .slice(0, QUESTIONS_PER_ROUND)
    .map(prepareQuestion);
}

// 틀린 문항을 다시 섞고 보기도 다시 섞는다.
function buildRetryRound(wrongQuestions) {
  return shuffle(wrongQuestions).map(prepareQuestion);
}

// 정답이 아닌 보기 위치 3개 중 2개를 무작위로 골라 돌려준다.
function pickHintRemovals(q) {
  const wrongIndexes = q.choices.map((_, i) => i).filter((i) => i !== q.answer);
  return shuffle(wrongIndexes).slice(0, 2);
}

// PRD 3.9: 맞히면 1점, 힌트 모드에서 힌트를 쓰고 맞히면 0.5점, 틀리면 0점
function scoreFor(mode, isCorrect, hintUsed) {
  if (!isCorrect) return 0;
  return mode === "hint" && hintUsed ? 0.5 : 1;
}

function rankingKey(mode, category) {
  return `${mode}:${category}`;
}

// 점수 높은 순으로 상위 RANKING_SIZE개만 남긴다. 동점이면 먼저 세운 기록이 위다(sort는 안정 정렬).
// 새 기록이 남았으면 1부터 센 순위를, 못 들었으면 null을 돌려준다. 원본 list는 바꾸지 않는다.
function addRecord(list, record) {
  const sorted = [...list, record].sort((a, b) => b.score - a.score).slice(0, RANKING_SIZE);
  const index = sorted.indexOf(record);
  return { list: sorted, rank: index === -1 ? null : index + 1 };
}

function todayString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ===== 3. 저장 (localStorage만 다룸) =====

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// 저장소를 쓸 수 없으면 null, 값이 없거나 깨졌으면 빈 순위표 {}를 돌려준다.
function loadRankings(storage) {
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveRankings(rankings, storage) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(rankings));
    return true;
  } catch {
    return false;
  }
}

// ===== 4. 게임 상태와 화면 조작 (브라우저에서만 쓰임) =====

const state = {
  mode: "practice",
  category: null,
  questions: [],    // 이번 판 문항(보기를 섞은 상태)
  index: 0,         // 지금 푸는 문항 번호
  score: 0,         // 첫 시도 점수
  wrong: [],        // 틀린 문항(연습 재도전용)
  isRetry: false,   // 재도전 중인지
  retryCorrect: 0,  // 재도전에서 맞힌 수
  hintUsed: false,  // 이번 문항에서 힌트를 썼는지
  answered: false,  // 이번 문항을 이미 채점했는지(두 번 채점 방지)
  timeLeft: 0,
  timerId: null,
};

const $ = (id) => document.getElementById(id);

function showScreen(id) {
  stopTimer();
  for (const section of document.querySelectorAll("main > section")) section.hidden = section.id !== id;
}

// 스피드 모드: 이전 타이머를 지우고 제한 시간부터 1초씩 센다. 0초가 되면 시간 초과로 채점한다.
function startTimer() {
  stopTimer();
  state.timeLeft = MODES[state.mode].timeLimit;
  $("timer").textContent = `${state.timeLeft}초`;
  state.timerId = setInterval(() => {
    state.timeLeft--;
    $("timer").textContent = `${state.timeLeft}초`;
    if (state.timeLeft <= 0) {
      stopTimer();
      showFeedback(null);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

function selectMode(mode) {
  state.mode = mode;
  for (const button of $("mode-buttons").querySelectorAll("button[data-mode]")) {
    button.classList.toggle("selected", button.dataset.mode === mode);
  }
  $("mode-desc").textContent = MODES[mode].desc;
}

function renderStart() {
  selectMode(state.mode);
  $("category-buttons").replaceChildren(...CATEGORIES.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.category = category;
    button.textContent = category;
    return button;
  }));
}

function startRound(category) {
  Object.assign(state, {
    category,
    questions: buildRound(QUESTIONS, category),
    index: 0,
    score: 0,
    wrong: [],
    isRetry: false,
    retryCorrect: 0,
  });
  showScreen("screen-quiz");
  renderQuestion();
}

// 연습 모드: 방금 푼 판에서 틀린 문항만 다시 푼다. 첫 시도 점수(state.score)는 바꾸지 않는다.
function startRetry() {
  Object.assign(state, {
    questions: buildRetryRound(state.wrong),
    wrong: [],
    index: 0,
    isRetry: true,
    retryCorrect: 0,
  });
  showScreen("screen-quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.index];
  state.answered = false;
  state.hintUsed = false;
  $("quiz-category").textContent = state.category;
  $("quiz-mode").textContent = state.isRetry ? `${MODES[state.mode].label} 재도전` : MODES[state.mode].label;
  $("quiz-progress").textContent = `${state.index + 1} / ${state.questions.length}`;
  $("quiz-score").textContent = `점수 ${state.score}`;
  $("question-text").textContent = q.question;
  $("choices").replaceChildren(...q.choices.map((text, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.dataset.index = i;
    button.textContent = text;
    return button;
  }));
  $("feedback").hidden = true;
  $("hint-btn").hidden = !MODES[state.mode].hint;
  $("hint-btn").disabled = false;

  const hasTimer = MODES[state.mode].timeLimit !== null;
  $("timer").hidden = !hasTimer;
  if (hasTimer) startTimer();
}

// 힌트 모드: 문항마다 한 번, 오답 보기 2개를 지운다. 지운 자리는 비워 두어 남은 보기의 위치가 바뀌지 않는다.
function useHint() {
  if (state.answered || state.hintUsed) return;
  state.hintUsed = true;
  const buttons = $("choices").querySelectorAll(".choice");
  for (const i of pickHintRemovals(state.questions[state.index])) {
    buttons[i].classList.add("removed");
    buttons[i].disabled = true;
  }
  $("hint-btn").disabled = true;
}

function choose(index) {
  if (state.answered) return;
  showFeedback(index);
}

// choiceIndex가 null이면 시간 초과다.
function showFeedback(choiceIndex) {
  if (state.answered) return;
  state.answered = true;
  stopTimer();

  const q = state.questions[state.index];
  const isCorrect = choiceIndex === q.answer;
  if (state.isRetry) {
    if (isCorrect) state.retryCorrect++;
  } else {
    state.score += scoreFor(state.mode, isCorrect, state.hintUsed);
  }
  if (!isCorrect) state.wrong.push(q);

  const buttons = $("choices").querySelectorAll(".choice");
  buttons[q.answer].classList.add("correct");
  if (choiceIndex !== null && !isCorrect) buttons[choiceIndex].classList.add("wrong");
  for (const button of buttons) button.disabled = true;
  $("hint-btn").disabled = true;

  $("feedback-result").textContent = choiceIndex === null ? MESSAGES.timeout : isCorrect ? MESSAGES.correct : MESSAGES.wrong;
  $("feedback-explanation").textContent = q.explanation;
  $("feedback-source").textContent = q.source.title;
  $("feedback-source").href = q.source.url;
  $("next-btn").textContent = state.index === state.questions.length - 1 ? "결과 보기" : "다음";
  $("quiz-score").textContent = `점수 ${state.score}`;
  $("feedback").hidden = false;
}

function nextQuestion() {
  if (state.index === state.questions.length - 1) {
    finishPass();
    return;
  }
  state.index++;
  renderQuestion();
}

function finishPass() {
  renderResult();
  showScreen("screen-result");
}

function renderResult() {
  $("result-category").textContent = state.category;
  $("result-mode").textContent = MODES[state.mode].label;
  $("result-score").textContent = `${state.score} / ${QUESTIONS_PER_ROUND}점`;
  $("result-note").textContent = MODES[state.mode].ranked ? "" : MESSAGES.notRanked;
  $("retry-result").hidden = !state.isRetry;
  $("retry-result").textContent = `재도전 ${state.retryCorrect}/${state.questions.length}`;
  $("retry-btn").hidden = !(state.mode === "practice" && state.wrong.length > 0);
}

function goHome() {
  renderStart();
  showScreen("screen-start");
}

// ===== 5. 자체 점검 (node script.js 또는 index.html?test) =====

const selfTestResults = [];

// fn()의 결과를 JSON으로 바꿔 expected와 비교한다. 예외가 나면 실패로 기록한다.
function check(name, fn, expected) {
  let actual;
  try {
    actual = fn();
  } catch (err) {
    selfTestResults.push({ name, pass: false, actual: `예외: ${err.message}`, expected });
    return;
  }
  selfTestResults.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
}

function runSelfTests(questions) {
  selfTestResults.length = 0;

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

  check("힌트: 2개, 서로 다름, 정답 아님(30회)", () => Array.from({ length: 30 }, () => {
    const r = pickHintRemovals(sample({ answer: 1 }));
    return r.length === 2 && r[0] !== r[1] && !r.includes(1) && r.every((i) => i >= 0 && i <= 3); }).every(Boolean), true);

  check("재도전: 틀린 문항만, 정답 유지", () => {
    const wrong = [1, 2, 3].map((n) => sample({ question: `틀린 ${n}`, answer: 3 }));
    const r = buildRetryRound(wrong);
    return [r.length, r.map((q) => q.question).sort(), r.every((q) => q.choices[q.answer] === "라")]; },
    [3, ["틀린 1", "틀린 2", "틀린 3"], true]);

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

  check("문항: 40문항 형식", () => validateQuestions(questions), []);

  let failed = 0;
  for (const r of selfTestResults) {
    if (r.pass) {
      console.log("통과:", r.name);
    } else {
      failed++;
      console.error("실패:", r.name, "실제:", JSON.stringify(r.actual), "기대:", JSON.stringify(r.expected));
    }
  }
  console.log(`자체 점검 결과: 통과 ${selfTestResults.length - failed}, 실패 ${failed}`);
  return failed;
}

// ===== 6. 시작 =====

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    for (const message of validateQuestions(QUESTIONS)) console.error("문항 데이터 오류:", message);
    if (new URLSearchParams(location.search).has("test")) runSelfTests(QUESTIONS);

    $("mode-buttons").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-mode]");
      if (button) selectMode(button.dataset.mode);
    });
    $("category-buttons").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category]");
      if (button) startRound(button.dataset.category);
    });
    $("choices").addEventListener("click", (event) => {
      const button = event.target.closest("button.choice");
      if (button) choose(Number(button.dataset.index));
    });
    $("next-btn").addEventListener("click", nextQuestion);
    $("hint-btn").addEventListener("click", useHint);
    $("home-btn").addEventListener("click", goHome);
    $("retry-btn").addEventListener("click", startRetry);

    goHome();
  });
}

if (typeof module !== "undefined" && require.main === module) {
  process.exitCode = runSelfTests(require("./questions.js")) ? 1 : 0;
}
