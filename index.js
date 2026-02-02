require('dotenv').config();
const { tavily } = require("@tavily/core");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const nodemailer = require("nodemailer");

/**
 * 1. Tavily 검색 (뉴스 및 커뮤니티 소스 이원화)
 */
async function fetchVibeNews() {
  console.log("🔍 Tavily에서 뉴스 및 커뮤니티 소스를 수집 중입니다...");
  const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
  
  const today = new Date().toISOString().split('T')[0];
  
  // 1. 뉴스 토픽: 브레이킹 뉴스 및 공식 발표 중심
  const newsQueries = [
    `Breaking news official AI releases ${today}`,
    `OpenAI Google Anthropic DeepMind new announcements last 24 hours`,
    `Generative AI for developer productivity news ${today}`
  ];

  // 2. 일반 토픽: 기술 커뮤니티 (GeekNews, Hacker News) 중심
  const communityQueries = [
    `site:news.hada.io AI latest`,
    `site:news.ycombinator.com AI latest`,
    `Vibe Coding tools and trends February 2026`,
    `Lovable.dev Cursor AI Claude Code update`
  ];

  try {
    const newsPromises = newsQueries.map(query => 
      tvly.search(query, { searchDepth: "advanced", topic: "news", maxResults: 15, days: 1 })
    );

    const communityPromises = communityQueries.map(query => 
      tvly.search(query, { searchDepth: "advanced", topic: "general", maxResults: 15, days: 1 })
    );

    const responses = await Promise.all([...newsPromises, ...communityPromises]);
    
    const urlSet = new Set();
    const uniqueResults = [];

    responses.forEach(resp => {
      if (resp.results) {
        resp.results.forEach(r => {
          if (!urlSet.has(r.url)) {
            urlSet.add(r.url);
            uniqueResults.push(r);
          }
        });
      }
    });

    console.log(`✅ 총 ${uniqueResults.length}개의 정예 소스(뉴스+커뮤니티)를 발견했습니다.`);

    if (uniqueResults.length === 0) {
      throw new Error("검색 결과가 없습니다.");
    }

    return uniqueResults.map(r => `제목: ${r.title}\n출처: ${r.url}\n내용: ${r.content}`).join("\n\n---\n\n");
  } catch (error) {
    console.error("Tavily 검색 실패:", error);
    throw error;
  }
}

/**
 * 2. Gemini 요약 (선생님 맞춤형 요약 생성)
 */
async function summarizeNews(rawText) {
  console.log("🤖 Gemini가 신선도를 엄격히 검증하며 요약 중입니다...");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  
  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const prompt = `
오늘은 ${todayStr}입니다. 당신은 "오늘" 발생한 최신 기술 소식만 선별하는 뉴스 큐레이터입니다.

[중요: 구형 정보 배제 지침]
1. [날짜 대조]: 
   - 기사 URL이나 내용에서 날짜를 찾아보세요. 2026년 2월 2일(또는 1일) 소식이 아닌 모든 정보는 과감히 버리세요.
   - 특히 "Gemini 3", "Antigravity 공개" 등 이미 과거에 발표된 정보가 '최신'으로 둔갑하여 포함되어 있다면 절대 리포트에 넣지 마세요.
   - URL에 /2025/, /2024/ 등이 포함되어 있거나 1월 중순 이전의 날짜가 있다면 즉시 제외하세요.

2. [신규성 검증 및 수량 확대]:
   - 어제까지의 기술 트렌드와 "무엇이 달라졌는지"가 명확한 소식만 남기세요.
   - 신선도와 품질이 담보된다면 리스트를 10개 내외로 확장하여 구성하세요. (단, 품질이 낮거나 구형인 정보를 억지로 넣어 10개를 채우라는 의미는 아닙니다.)
   - 만약 수집된 모든 기사가 구형이거나 가치가 없다면, "오늘의 유의미한 신규 소식이 없습니다"라고만 답변하세요.

3. [출처 우선순위]:
   - 공식 블로그(OpenAI, Google 등) > Tech 소식지(GeekNews, HN, TechCrunch) 순으로 가중치를 둡니다.

4. [가독성 및 마크다운 금지]:
   - **절대 주의**: 어떠한 마크다운 문법(특히 **글자 강조**)도 사용하지 마세요. 
   - 제목이나 강조하고 싶은 부분은 별도의 기호 없이 줄바꿈과 대괄호[]만 활용하세요.
   - 메일에서 텍스트가 깨지지 않도록 순수 텍스트와 줄바꿈만 사용하세요.

5. [작성 형식]:
   - [제목]
   - (URL)
   - [Key Insight]: 본질적 변화와 파급력을 3~4문장으로 심층 분석하세요.

[구성]
- [오늘의 AI & 바이브 코딩 실시간 인사이트 리포트]
- (검증된 정예 리스트)

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
    subject: `[Daily Insight] ${today} 최신 Tech 리포트`,
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
    // 요약 결과가 유의미할 때만 메일 발송
    if (summary && summary.trim().length > 30) {
      await sendEmail(summary);
      console.log("🎉 오늘의 정예 리포트 발송 완료!");
    } else {
      console.log("⚠️ 발송할 만한 최신 유의미한 소식이 없어 발송을 스킵합니다.");
    }
    
  } catch (error) {
    console.error("❌ 작업 도중 오류가 발생했습니다:", error.message);
    process.exit(1);
  }
}

main();
