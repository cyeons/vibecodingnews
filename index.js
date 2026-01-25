require('dotenv').config();
const { tavily } = require("@tavily/core");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const nodemailer = require("nodemailer");

/**
 * 1. Tavily 검색 (최신 바이브 코딩 정보 수집)
 */
async function fetchVibeNews() {
  console.log("🔍 Tavily에서 다양한 소스의 최신 뉴스를 검색 중입니다...");
  const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
  
  const today = new Date().toISOString().split('T')[0];
  
  // 1. 바이브 코딩 및 AI 코딩 에이전트 관련 통합 쿼리
  const query = `"Vibe Coding" OR "AI Coding Agent" (site:news.hada.io OR site:reddit.com OR site:x.com OR site:news.ycombinator.com OR site:dev.to) after:${today}`;
  
  try {
    const response = await tvly.search(query, {
      searchDepth: "advanced",
      maxResults: 15, // 더 넓은 범위에서 수집 후 Gemini가 선별하게 함
      includeAnswer: true
    });

    if (!response.results || response.results.length === 0) {
      throw new Error("검색 결과가 없습니다.");
    }

    return response.results.map(r => `제목: ${r.title}\n출처: ${r.url}\n내용: ${r.content}`).join("\n\n---\n\n");
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
  // 가장 안정적이고 빠른 1.5-flash 모델 사용 권장
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  
const prompt = `
당신은 초등교사이자 에듀테크 전문가입니다. 아래는 지난 24시간 동안 전 세계 커뮤니티(Reddit, X, 블로그 등)에서 수집된 '바이브 코딩(Vibe Coding)' 및 AI 관련 주요 게시글들입니다.

전체적인 트렌드 요약 대신, 수집된 각 게시글(최대 10개)을 하나씩 개별적으로 자세히 소개해주세요.

[중요 지시사항]
1. 메일에서 가독성을 해치는 별표(**)나 기호(##) 같은 마크다운 형식을 절대 사용하지 마세요.
2. 각 게시글마다 아래의 정보를 포함해 주세요:
   - [글 제목]
   - (원본 링크)
   - [상세 내용 설명]: 단순히 요약하지 말고, 이 글이 왜 중요한지, 어떤 기술적 내용이나 커뮤니티의 반응이 담겨 있는지 선생님들이 이해하기 쉽게 아주 자세히 설명해 주세요.
3. 개별 게시글 사이에는 줄바꿈이나 구분선을 사용하여 명확히 구분해 주세요.

[구성]
- [오늘의 바이브 코딩 뉴스레터 소개]
- (각 게시글 상세 리스트 1 ~ 10)
- [선생님들을 위한 오늘의 생각]

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
