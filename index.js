require('dotenv').config();
const { tavily } = require("@tavily/core");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const nodemailer = require("nodemailer");

/**
 * 1. Tavily 검색 (최신 바이브 코딩 정보 수집)
 */
async function fetchVibeNews() {
  console.log("🔍 Tavily에서 최근 24시간 뉴스를 검색 중입니다...");
  const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
  
  // 정확히 어제~오늘 사이의 뉴스만 가져오기 위해 날짜 계산
  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const dateLimit = yesterday.toISOString().split('T')[0];
  
  // 1. 해외(Global) 쿼리: 바이브 코딩 + 일반 AI 활용/생산성
  const globalQuery = `("Vibe Coding" OR "AI Coding Agent" OR "AI for productivity" OR "Generative AI tools") (site:news.hada.io OR site:reddit.com OR site:x.com OR site:news.ycombinator.com OR site:dev.to) after:${dateLimit}`;
  
  // 2. 국내(Domestic) 쿼리: 바이브 코딩 + AI 업무 활용/교육 자동화 (커서 AI 제외)
  const domesticQuery = `("바이브 코딩" OR "AI 코딩 에이전트" OR "AI 활용 능력" OR "AI 업무 자동화" OR "생성형 AI 교육") (site:geeknews.hada.io OR site:velog.io OR site:brunch.co.kr OR site:tistory.com OR site:fmkorea.com OR site:ruliweb.com OR site:clien.net OR site:news.naver.com OR site:news.daum.net OR site:chosun.com OR site:hani.co.kr OR site:joins.com) after:${dateLimit}`;

  try {
    console.log("✈️ 해외 소식 검색 중...");
    const globalResponse = await tvly.search(globalQuery, {
      searchDepth: "advanced",
      maxResults: 15,
    });

    console.log("🇰🇷 국내 소식 검색 중...");
    const domesticResponse = await tvly.search(domesticQuery, {
      searchDepth: "advanced",
      maxResults: 15,
    });

    const results = [];
    
    if (globalResponse.results && globalResponse.results.length > 0) {
      results.push("### [글로벌 소식]");
      results.push(...globalResponse.results.map(r => `제목: ${r.title}\n출처: ${r.url}\n내용: ${r.content}`));
    }

    if (domesticResponse.results && domesticResponse.results.length > 0) {
      results.push("\n### [국내 소식]");
      results.push(...domesticResponse.results.map(r => `제목: ${r.title}\n출처: ${r.url}\n내용: ${r.content}`));
    }

    if (results.length === 0) {
      throw new Error("검색 결과가 없습니다.");
    }

    return results.join("\n\n---\n\n");
  } catch (error) {
    console.error("Tavily 검색 실패:", error);
    throw error;
  }
}

/**
 * 2. Gemini 요약 (선생님 맞춤형 요약 생성)
 */
async function summarizeNews(rawText) {
  console.log("🤖 Gemini가 내용을 분석하여 요약 중입니다...");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  
const prompt = `
당신은 기술의 흐름을 알기 쉽게 전달하는 테크 커뮤니케이터입니다. 아래 데이터는 지난 24시간 동안 수집된 '바이브 코딩(Vibe Coding)' 및 'AI 활용/생산성' 관련 뉴스입니다.

이 뉴스레터를 읽는 분들은 코딩을 전혀 모르는 교육 종사자들입니다. 최신 AI 기술이 가져올 미래의 변화와 그 가치를 포착하여, 복잡한 용어 없이 친절하고 상세하게 분석해 주세요.

[중요 지시사항]
1. [기사 선별 기준]: 정보의 가치와 파급력을 중심으로 가장 유의미한 소식을 엄선하세요. (내용 자체가 쉽거나 어려운지는 기준이 아닙니다.)
   - 파급력: 기술적 혁신이 크거나 업무 방식을 근본적으로 바꿀 수 있는 중요한 소식인가?
   - 혁신성: AI가 스스로 코드를 생성하거나 문제를 해결하는 '바이브 코딩'의 진보를 잘 보여주는가?
   - 화제성: 커뮤니티(Reddit, HN, GeekNews 등)에서 높은 관심을 받으며 활발히 논의되는 주제인가?

2. [비율 및 구성]:
   - '바이브 코딩' 및 AI 에이전트 소식 70%, '일반 AI 도구 및 생산성' 소식 30% 비율로 구성하세요.
   - [국내 소식] 섹션에서 유의미한 소식을 최소 3개 이상 반드시 포함해야 합니다. (전체 기사는 최대 10개)

3. [내용 구성 지침]: 
   - 대신 해당 기술의 구조, 작동 원리, 커뮤니티의 반응, 그리고 실제 개발 및 업무 현장에 미칠 파급력을 기술적인 관점에서 상세히 분석하세요.
   - 전문 용어를 적절히 사용하되, 비전공자도 논리적 흐름을 이해할 수 있도록 명확하게 설명하세요.

4. [가독성 설정]:
   - 마크다운 기호(**, ## 등)를 사용하지 말고 줄바꿈과 공백을 활용하여 깔끔하게 작성하세요.

5. [작성 형식]:
   - [글 제목]
   - (원본 링크)
   - [심층 내용 분석]: 글의 핵심 내용을 요약하는 것을 넘어, 이 기술이 왜 중요한지, 어떤 문제를 해결하는지, 그리고 향후 관련 산업이나 개발 생태계에 어떤 변화를 가져올지 전문적으로 기술하세요.

[구성]
- [오늘의 테크 리포트: 바이브 코딩 & AI 생산성 트렌드]
- (엄선된 심층 리스트 1 ~ 10)

[원문 데이터]
${rawText}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini 요약 실패:", error);
    throw error;
  }
}

/**
 * 3. 이메일 발송 (Gmail SMTP)
 */
async function sendEmail(summary) {
  console.log("✉️ 뉴스레터를 이메일로 발송 중입니다...");
  
  // SMTP 설정
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD // 앱 비밀번호 사용 필수
    }
  });

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: `"바이브 코딩 뉴스레터" <${process.env.GMAIL_USER}>`,
    to: process.env.RECEIVER_EMAIL,
    subject: `[Daily] ${today} 오늘의 바이브 코딩 & AI 팁`,
    text: summary,
    // HTML 형식을 사용하고 싶다면 아래 주석 해제 후 처리 가능
    // html: summary.replace(/\n/g, '<br>') 
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ 메일 발송 성공:", info.messageId);
  } catch (error) {
    console.error("메일 발송 실패:", error);
    throw error;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    // 0. 환경 변수 체크
    const requiredEnv = ['TAVILY_API_KEY', 'GEMINI_API_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'RECEIVER_EMAIL'];
    const missing = requiredEnv.filter(k => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`누락된 환경 변수가 있습니다: ${missing.join(', ')}`);
    }

    // 1. 뉴스 수집
    const news = await fetchVibeNews();
    
    // 2. 뉴스 요약
    const summary = await summarizeNews(news);
    
    // 3. 이메일 발송
    await sendEmail(summary);
    
    console.log("🎉 오늘의 모든 작업이 기분 좋게 완료되었습니다!");
  } catch (error) {
    console.error("❌ 작업 도중 오류가 발생했습니다:", error.message);
    process.exit(1);
  }
}

main();
