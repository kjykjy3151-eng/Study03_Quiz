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
const EXPLANATION_MAX = 80; // PRD 4.3 규칙 4 "60자 안팎"의 상한
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

// PRD 3.9: 맞히면 1점, 힌트 모드에서 힌트를 쓰고 맞히면 0.5점, 틀리면 0점
function scoreFor(mode, isCorrect, hintUsed) {
  if (!isCorrect) return 0;
  return mode === "hint" && hintUsed ? 0.5 : 1;
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

  check("문항: 작성분 형식", () => validateQuestions(questions, ["한국사"]), []);

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
  });
}

if (typeof module !== "undefined" && require.main === module) {
  process.exitCode = runSelfTests(require("./questions.js")) ? 1 : 0;
}
